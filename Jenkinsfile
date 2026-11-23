pipeline {
    agent any

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
                    if ! docker buildx inspect securegate-ci >/dev/null 2>&1; then
                        docker buildx create \
                            --name securegate-ci \
                            --driver docker-container \
                            --driver-opt network=host \
                            --buildkitd-flags '--allow-insecure-entitlement network.host' \
                            --use
                    else
                        docker buildx use securegate-ci
                    fi
                    docker buildx inspect --bootstrap
                '''
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
                docker compose -f docker-compose.yml -f .jenkins-ci-compose.yml down --volumes --remove-orphans || true
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
