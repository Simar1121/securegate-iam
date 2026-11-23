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
                sh '''docker run --rm --network host node:22-bookworm-slim node -e "require('dns').lookup('registry-1.docker.io', (err, address) => { if (err) { console.error('Docker Hub DNS failed:', err.code); process.exit(1); return; } console.log('Docker Hub DNS OK:', address); fetch('https://registry-1.docker.io/v2/').then(r => { console.log('Docker Hub registry HTTP:', r.status); process.exit(r.status === 401 || r.ok ? 0 : 1); }).catch(err => { console.error('Docker Hub HTTPS failed:', err.cause || err); process.exit(1); }); });"'''
            }
        }

        stage('Check npm registry connectivity') {
            steps {
                sh '''docker run --rm --network host node:22-bookworm-slim node -e "fetch('https://registry.npmjs.org/npm').then(r => { console.log('npm registry HTTP ' + r.status); process.exit(r.ok ? 0 : 1); }).catch(err => { console.error('Cannot reach npm registry:', err.cause || err); process.exit(1); });"'''
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
