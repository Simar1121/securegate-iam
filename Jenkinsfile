pipeline {
    agent any

    environment {
        // Docker CLI gives DOCKER_CONTEXT precedence over the service's DOCKER_HOST.
        DOCKER_CONTEXT = 'securegate-dind'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 45, unit: 'MINUTES')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git rev-parse --short HEAD'
            }
        }

        stage('Generate disposable CI credentials') {
            steps {
                sh '''
                    set +x
                    umask 077

                    # Fresh random credentials for this build only.
                    # They are never committed and are removed in post-build cleanup.
                    CI_VOLUME_SUFFIX="$(printf '%s' "${JOB_NAME}-${BUILD_NUMBER}" | sha256sum | cut -c1-12)-${BUILD_NUMBER}"
                    MONGO_PASSWORD="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \\n')"
                    JWT_SECRET="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \\n')"

                    cat > .env <<EOF
MONGO_INITDB_ROOT_USERNAME=securegate_ci
MONGO_INITDB_ROOT_PASSWORD=$MONGO_PASSWORD
COMPOSE_PROJECT_NAME=sgjenkins-$CI_VOLUME_SUFFIX
CI_VOLUME_SUFFIX=$CI_VOLUME_SUFFIX
EOF

                    cat > .jenkins-ci-compose.yml <<'EOF'
volumes:
  securegate_docker_mongodb_data:
    name: securegate_jenkins_ci_${CI_VOLUME_SUFFIX:?CI_VOLUME_SUFFIX is required}
EOF

                    # Keep this workaround limited to CI image-build RUN steps.
                    cat > .jenkins-ci-build-network.yml <<'EOF'
services:
  backend-test:
    build:
      network: host
      entitlements:
        - network.host
  backend:
    build:
      network: host
      entitlements:
        - network.host
  frontend:
    build:
      network: host
      entitlements:
        - network.host
EOF

                    cat > server/.env <<EOF
PORT=5000
NODE_ENV=test
MONGODB_URI=mongodb://securegate_ci:$MONGO_PASSWORD@mongodb:27017/securegate_jenkins_test?authSource=admin
MONGODB_TEST_URI=mongodb://securegate_ci:$MONGO_PASSWORD@mongodb:27017/securegate_jenkins_test?authSource=admin
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:8080
TRUST_PROXY_HOPS=0
FRONTEND_URL=http://localhost:8080
EOF
                '''
            }
        }

        stage('Validate Compose configuration') {
            steps {
                sh 'docker compose -f docker-compose.yml -f .jenkins-ci-compose.yml -f .jenkins-ci-build-network.yml config --quiet'
            }
        }

        stage('Prepare BuildKit host networking') {
            steps {
                sh '''
                    set -eu

                    # Buildx cannot create a docker-container builder directly from
                    # TLS credentials supplied only through DOCKER_* environment vars.
                    # Keep Docker CLI commands on the named context. DOCKER_CONTEXT
                    # takes precedence over DOCKER_HOST and retains TLS verification.
                    DOCKER_CONTEXT_NAME=securegate-dind
                    BUILDER_NAME=securegate-ci

                    test "$DOCKER_TLS_VERIFY" = "1"
                    test "$DOCKER_CONTEXT" = "$DOCKER_CONTEXT_NAME"
                    test -r "$DOCKER_CERT_PATH/ca.pem"
                    test -r "$DOCKER_CERT_PATH/cert.pem"
                    test -r "$DOCKER_CERT_PATH/key.pem"

                    CONTEXT_REFRESH_REQUIRED=0
                    if ! docker context inspect "$DOCKER_CONTEXT_NAME" >/dev/null 2>&1; then
                        CONTEXT_REFRESH_REQUIRED=1
                    else
                        CONTEXT_HOST="$(docker context inspect "$DOCKER_CONTEXT_NAME" --format '{{.Endpoints.docker.Host}}')"
                        CONTEXT_TLS_PATH="$(docker context inspect "$DOCKER_CONTEXT_NAME" --format '{{.Storage.TLSPath}}')"
                        CONTEXT_TLS_PATH="$CONTEXT_TLS_PATH/docker"
                        if [ "$CONTEXT_HOST" != "$DOCKER_HOST" ] ||
                           [ ! -r "$CONTEXT_TLS_PATH/ca.pem" ] ||
                           [ ! -r "$CONTEXT_TLS_PATH/cert.pem" ] ||
                           [ ! -r "$CONTEXT_TLS_PATH/key.pem" ] ||
                           ! cmp -s "$DOCKER_CERT_PATH/ca.pem" "$CONTEXT_TLS_PATH/ca.pem" ||
                           ! cmp -s "$DOCKER_CERT_PATH/cert.pem" "$CONTEXT_TLS_PATH/cert.pem" ||
                           ! cmp -s "$DOCKER_CERT_PATH/key.pem" "$CONTEXT_TLS_PATH/key.pem"; then
                            CONTEXT_REFRESH_REQUIRED=1
                        fi
                    fi

                    if [ "$CONTEXT_REFRESH_REQUIRED" -eq 1 ]; then
                        # Update the context in place to retain its identity and
                        # avoid discarding the dependent BuildKit cache.
                        if docker context inspect "$DOCKER_CONTEXT_NAME" >/dev/null 2>&1; then
                            docker context update "$DOCKER_CONTEXT_NAME" \
                                --description "SecureGate Jenkins TLS Docker-in-Docker endpoint" \
                                --docker "host=$DOCKER_HOST,ca=$DOCKER_CERT_PATH/ca.pem,cert=$DOCKER_CERT_PATH/cert.pem,key=$DOCKER_CERT_PATH/key.pem"
                        else
                            docker context create "$DOCKER_CONTEXT_NAME" \
                                --description "SecureGate Jenkins TLS Docker-in-Docker endpoint" \
                                --docker "host=$DOCKER_HOST,ca=$DOCKER_CERT_PATH/ca.pem,cert=$DOCKER_CERT_PATH/cert.pem,key=$DOCKER_CERT_PATH/key.pem"
                        fi
                    fi

                    BUILDER_RECREATE_REQUIRED=0
                    if ! docker buildx inspect "$BUILDER_NAME" --bootstrap >/dev/null 2>&1; then
                        BUILDER_RECREATE_REQUIRED=1
                    elif ! docker buildx inspect "$BUILDER_NAME" | grep -F "Endpoint: $DOCKER_CONTEXT_NAME" >/dev/null; then
                        BUILDER_RECREATE_REQUIRED=1
                    fi

                    if [ "$BUILDER_RECREATE_REQUIRED" -eq 1 ]; then
                        # Keep BuildKit state when repairing only this builder.
                        docker buildx rm --keep-state "$BUILDER_NAME" >/dev/null 2>&1 || true
                        docker buildx create \
                            --name "$BUILDER_NAME" \
                            --driver docker-container \
                            --driver-opt network=host \
                            --buildkitd-flags '--allow-insecure-entitlement network.host' \
                            --use "$DOCKER_CONTEXT_NAME"
                    else
                        docker buildx use "$BUILDER_NAME"
                    fi

                    docker buildx inspect "$BUILDER_NAME" --bootstrap
                '''
            }
        }

        stage('Check Docker Hub registry connectivity') {
            steps {
                sh '''
                    docker run --rm --interactive --network host node:22-bookworm-slim node <<'NODE'
                    const dns = require('node:dns');
                    const https = require('node:https');
                    const host = 'registry-1.docker.io';
                    const attempts = 3;
                    const maxAddresses = 4;
                    const dnsDeadlineMs = 5000;
                    const httpsAttemptDeadlineMs = 5000;

                    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

                    function resolveIpv4() {
                      const resolver = new dns.Resolver({ timeout: dnsDeadlineMs, tries: 1 });
                      return new Promise((resolve, reject) => {
                        const deadline = setTimeout(() => {
                          reject(Object.assign(new Error(`DNS resolution exceeded ${dnsDeadlineMs}ms`), { code: 'ETIMEDOUT' }));
                          resolver.cancel();
                        }, dnsDeadlineMs);

                        resolver.resolve4(host, (error, addresses) => {
                          clearTimeout(deadline);
                          if (error) reject(error);
                          else resolve(addresses);
                        });
                      });
                    }

                    function requestAddress(address) {
                      return new Promise((resolve, reject) => {
                        let settled = false;
                        let deadline;
                        const finish = (error, status) => {
                          if (settled) return;
                          settled = true;
                          clearTimeout(deadline);
                          if (error) reject(error);
                          else resolve(status);
                        };

                        const request = https.request({
                          hostname: host,
                          servername: host,
                          path: '/v2/',
                          family: 4,
                          rejectUnauthorized: true,
                          lookup: (_hostname, _options, callback) => callback(null, address, 4),
                        }, (response) => {
                          response.once('error', (error) => finish(error));
                          response.once('aborted', () => finish(Object.assign(new Error('response aborted before completion'), { code: 'ECONNRESET' })));
                          response.once('close', () => {
                            if (!response.complete) {
                              finish(Object.assign(new Error('response closed before completion'), { code: 'ECONNRESET' }));
                            }
                          });
                          response.once('end', () => {
                            if (response.complete) finish(null, response.statusCode);
                            else finish(Object.assign(new Error('response ended before completion'), { code: 'ECONNRESET' }));
                          });
                          response.resume();
                        });

                        request.once('error', (error) => finish(error));
                        deadline = setTimeout(() => {
                          request.destroy(Object.assign(new Error(`HTTPS attempt exceeded ${httpsAttemptDeadlineMs}ms`), { code: 'ETIMEDOUT' }));
                        }, httpsAttemptDeadlineMs);
                        request.end();
                      });
                    }

                    async function checkRegistry() {
                      let lastFailure = 'no IPv4 addresses resolved';

                      for (let attempt = 1; attempt <= attempts; attempt += 1) {
                        let addresses;
                        try {
                          addresses = await resolveIpv4();
                          if (addresses.length === 0) throw Object.assign(new Error('no IPv4 addresses returned'), { code: 'ENODATA' });
                          console.log(`Docker Hub DNS OK: ${addresses.length} IPv4 address(es)`);
                        } catch (error) {
                          lastFailure = `DNS ${error.code || error.name}: ${error.message}`;
                          console.error(`Docker Hub DNS attempt ${attempt}/${attempts} failed: ${lastFailure}`);
                          if (attempt < attempts) await delay(attempt * 1000);
                          continue;
                        }

                        const candidates = addresses.slice(0, maxAddresses);
                        for (let index = 0; index < candidates.length; index += 1) {
                          try {
                            const status = await requestAddress(candidates[index]);
                            if (status === 401 || (status >= 200 && status < 300)) {
                              console.log(`Docker Hub HTTPS OK (HTTP ${status}; 401 is expected without registry credentials)`);
                              return;
                            }
                            lastFailure = `HTTP ${status}`;
                            console.error(`Docker Hub IPv4 HTTPS candidate ${index + 1}/${candidates.length} returned ${lastFailure}`);
                          } catch (error) {
                            lastFailure = `${error.code || error.name}: ${error.message}`;
                            console.error(`Docker Hub IPv4 HTTPS candidate ${index + 1}/${candidates.length} failed: ${lastFailure}`);
                          }
                        }

                        if (attempt < attempts) await delay(attempt * 1000);
                      }

                      console.error(`Docker Hub HTTPS preflight failed after ${attempts} attempts: ${lastFailure}`);
                      process.exitCode = 1;
                    }

                    checkRegistry().catch((error) => {
                      console.error(`Docker Hub HTTPS preflight failed: ${error.code || error.name}: ${error.message}`);
                      process.exitCode = 1;
                    });
NODE
                '''
            }
        }

        stage('Check npm registry connectivity') {
            steps {
                sh '''docker run --rm --network host node:22-bookworm-slim node -e "fetch('https://registry.npmjs.org/npm', { signal: AbortSignal.timeout(15000) }).then(r => { console.log('npm registry HTTP ' + r.status); process.exit(r.ok ? 0 : 1); }).catch(err => { const cause = err.cause || err; console.error('npm registry HTTPS failed:', cause.code || cause.name, cause.message); process.exit(1); });"'''
            }
        }

        stage('Build backend test image') {
            steps {
                sh 'docker compose -f docker-compose.yml -f .jenkins-ci-compose.yml -f .jenkins-ci-build-network.yml --profile test build backend-test'
            }
        }

        stage('Start isolated test database') {
            steps {
                sh 'docker compose -f docker-compose.yml -f .jenkins-ci-compose.yml up -d mongodb'
            }
        }

        stage('Run backend security regression suite') {
            steps {
                sh 'docker compose -f docker-compose.yml -f .jenkins-ci-compose.yml --profile test run --rm backend-test'
            }
        }

        stage('Build production backend and frontend') {
            steps {
                sh 'docker compose -f docker-compose.yml -f .jenkins-ci-compose.yml -f .jenkins-ci-build-network.yml build backend frontend'
            }
        }
    }

    post {
        always {
            sh '''
                set +x
                docker compose -f docker-compose.yml -f .jenkins-ci-compose.yml down --remove-orphans || true
                rm -f .env server/.env .jenkins-ci-compose.yml .jenkins-ci-build-network.yml
            '''
        }
        success {
            echo 'SecureGate CI passed: backend security tests and production frontend/backend image builds completed.'
        }
        failure {
            echo 'SecureGate CI failed. Review the stage logs above; disposable database data and temporary environment files are cleaned up.'
        }
    }
}
