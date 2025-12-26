#!/bin/bash

# Environment generation logic for Zibaldone

source scripts/common.sh

generate_backend_env() {
    local mode=$1
    local api_base=$2
    local storage_type=$3
    local s3_endpoint=$4
    local s3_key=$5
    local s3_secret=$6
    local s3_bucket=$7
    local s3_public_url=$8

    log_info "Generating backend/.env..."

    # Use localhost for custom mode if it's pointing to a local litellm proxy
    # otherwise use the provided API base.
    local backend_api_base
    if [ "$mode" = "custom" ]; then
        backend_api_base="$api_base"
    else
        backend_api_base="http://localhost:4000"
    fi

    cat > backend/.env <<EOL
# Zibaldone Backend Configuration
LLM_MODEL=openai/zibaldone-model
OPENAI_API_BASE=$backend_api_base
OPENAI_API_KEY=sk-any
EOL

    if [ "$mode" = "docker" ]; then
        cat >> backend/.env <<EOL
LITELLM_URL=http://litellm:4000
STORAGE_TYPE=s3
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=zibaldoneadmin
S3_SECRET_KEY=zibaldonepassword
S3_BUCKET_NAME=zibaldone-blobs
S3_REGION=us-east-1
S3_PUBLIC_URL=http://localhost:9000
EOL
    elif [ "$mode" = "local" ]; then
        cat >> backend/.env <<EOL
STORAGE_TYPE=s3
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=zibaldoneadmin
S3_SECRET_KEY=zibaldonepassword
S3_BUCKET_NAME=zibaldone-blobs
S3_REGION=us-east-1
EOL
    elif [ "$mode" = "custom" ]; then
        cat >> backend/.env <<EOL
STORAGE_TYPE=$storage_type
S3_ENDPOINT=$s3_endpoint
S3_ACCESS_KEY=$s3_key
S3_SECRET_KEY=$s3_secret
S3_BUCKET_NAME=$s3_bucket
S3_REGION=us-east-1
EOL
    fi

    log_success "Created backend/.env"
}
