#!/bin/bash

# Dependencies provided by main scripts

configure_litellm() {
    local model_config=$1
    local api_base=$2
    
    log_info "Generating litellm_config.yaml..."
    cat > litellm_config.yaml <<EOL
model_list:
  - model_name: zibaldone-model
    litellm_params:
      model: ${model_config}
      api_base: "${api_base}"
      api_key: "any-string"
EOL
    log_success "Created litellm_config.yaml"
}

cleanup_litellm() {
    log_info "Cleaning up LiteLLM..."
    if [ -f "litellm_config.yaml" ]; then
        rm litellm_config.yaml
        log_success "Removed litellm_config.yaml"
    fi
}
