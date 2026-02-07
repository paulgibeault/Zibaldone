#!/bin/bash

# Dependencies provided by main scripts

configure_litellm() {
    local model_config=$1
    local api_base=$2
    local api_key=${3:-"any-string"} # Default to any-string if not provided
    
    log_info "Generating litellm_config.yaml..."
    cat > litellm_config.yaml <<EOL
model_list:
  - model_name: zibaldone-model
    litellm_params:
      model: ${model_config}
      api_base: "${api_base}"
      api_key: "${api_key}"
EOL
    log_success "Created litellm_config.yaml"
}

get_litellm_key() {
    local api_base=$1
    local api_key=""

    # Check if auth is required by attempting a request
    # If 401 or 403, we need a key
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "${api_base%/}/models")

    if [ "$http_code" == "401" ] || [ "$http_code" == "403" ]; then
        log_warning "Authentication required for $api_base (HTTP $http_code)" >&2
        prompt_secret "Enter API Key" api_key >&2
    elif [ "$http_code" == "000" ]; then
         log_error "Could not connect to $api_base. Check if the server is running." >&2
         return 1
    fi

    echo "$api_key"
}

select_model() {
    local api_base=$1
    local default_model=$2
    local api_key=$3

    log_info "Querying available models from $api_base..." >&2
    
    # Try to fetch models
    local models_json
    local auth_header=""
    if [ -n "$api_key" ]; then
        auth_header="-H \"Authorization: Bearer $api_key\""
    fi

    # Use eval to handle the quoted header string correctly
    models_json=$(eval curl -s -m 5 "$auth_header" "${api_base%/}/models" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$models_json" ]; then
        # Parse model IDs using python
        local models
        models=$(echo "$models_json" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    # Check both 'data' (OpenAI standard) and direct list (some implementations)
    if isinstance(data, dict):
        items = data.get('data', [])
    elif isinstance(data, list):
        items = data
    else:
        items = []
        
    ids = []
    for m in items:
        if isinstance(m, dict) and 'id' in m:
            ids.append(m['id'])
        elif isinstance(m, str):
            ids.append(m)
            
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
