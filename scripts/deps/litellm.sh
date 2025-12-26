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

select_model() {
    local api_base=$1
    local default_model=$2

    log_info "Querying available models from $api_base..." >&2
    
    # Try to fetch models
    local models_json
    models_json=$(curl -s -m 5 "${api_base%/}/models" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$models_json" ]; then
        # Parse model IDs using python
        local models
        models=$(echo "$models_json" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    ids = [m['id'] for m in data.get('data', [])]
    if ids:
        print('\n'.join(ids))
except Exception:
    pass
" 2>/dev/null)

        if [ -n "$models" ]; then
            echo -e "\nAvailable Models:" >&2
            local model_array=($models)
            for i in "${!model_array[@]}"; do
                echo "$((i+1))) ${model_array[i]}" >&2
            done
            echo "$(( ${#model_array[@]} + 1 ))) Enter manually..." >&2
            
            read -p "Select a model [1-$(( ${#model_array[@]} + 1 ))]: " selection >&2
            
            if [[ "$selection" =~ ^[0-9]+$ ]] && [ "$selection" -ge 1 ] && [ "$selection" -le "${#model_array[@]}" ]; then
                echo "${model_array[$((selection-1))]}"
                return
            fi
        fi
    fi

    # Fallback to manual entry
    read -p "Enter Model ID [$default_model]: " user_model >&2
    echo "${user_model:-$default_model}"
}

cleanup_litellm() {
    log_info "Cleaning up LiteLLM..."
    if [ -f "litellm_config.yaml" ]; then
        rm litellm_config.yaml
        log_success "Removed litellm_config.yaml"
    fi
}
