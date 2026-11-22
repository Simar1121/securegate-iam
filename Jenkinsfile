pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
        timeout(time: 45, unit: 'MINUTES')
    }

    environment {
        CI_COMPOSE_PROJECT = 'securegate-jenkins-ci'
        DOCKER_BUILDKIT = '1'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git rev-parse --short HEAD'
            }
        }

        stage('Prepare isolated CI credentials') {
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'securegate-ci-mongodb',
                        usernameVariable: 'MONGO_USER',
                        passwordVariable: 'MONGO_PASSWORD'
                    ),
                    string(
                        credentialsId: 'securegate-ci-jwt-secret',
                        variable: 'JWT_SECRET'
                    ),
                    usernamePassword(
                        credentialsId: 'securegate-ci-smtp',
                        usernameVariable: 'SMTP_USER',
                        passwordVariable: 'SMTP_APP_PASSWORD'
                    )
                ]) {
                    sh '''
                        set +x
                        umask 077

                        # These temporary files exist only in the Jenkins workspace.
                        # They are ignored by Git and removed in the post-build cleanup.
                        printf 'MONGO_INITDB_ROOT_USERNAME=%s\\nMONGO_INITDB_ROOT_PASSWORD=%s\\n' \
                            "$MONGO_USER" "$MONGO_PASSWORD" > .env

                        cat > server/.env <<EOF
PORT=5000
NODE_ENV=test
MONGODB_URI=mongodb://$MONGO_USER:$MONGO_PASSWORD@mongodb:27017/securegate_jenkins_test?authSource=admin
MONGODB_TEST_URI=mongodb://$MONGO_USER:$MONGO_PASSWORD@mongodb:27017/securegate_jenkins_test?authSource=admin
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:8080
TRUST_PROXY_HOPS=0
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=$SMTP_USER
SMTP_APP_PASSWORD=$SMTP_APP_PASSWORD
EMAIL_FROM=SecureGate CI <$SMTP_USER>
FRONTEND_URL=http://localhost:8080
EOF
                    '''
                }
            }
        }

        stage('Validate Compose configuration') {
            steps {
                sh 'docker compose -p "$CI_COMPOSE_PROJECT" config --quiet'
            }
        }

        stage('Build backend test image') {
            steps {
                sh 'docker compose -p "$CI_COMPOSE_PROJECT" --profile test build backend-test'
            }
        }

        stage('Start isolated test database') {
            steps {
                sh 'docker compose -p "$CI_COMPOSE_PROJECT" up -d mongodb'
            }
        }

        stage('Run backend security regression suite') {
            steps {
                sh 'docker compose -p "$CI_COMPOSE_PROJECT" --profile test run --rm backend-test'
            }
        }

        stage('Build production backend and frontend') {
            steps {
                sh 'docker compose -p "$CI_COMPOSE_PROJECT" build backend frontend'
            }
        }
    }

    post {
        always {
            sh '''
                set +x
                docker compose -p securegate-jenkins-ci down --volumes --remove-orphans || true
                rm -f .env server/.env
            '''
        }
        success {
            echo 'SecureGate CI passed: backend security tests and production image builds completed.'
        }
        failure {
            echo 'SecureGate CI failed. Review the stage logs above; no test database is retained.'
        }
    }
}
