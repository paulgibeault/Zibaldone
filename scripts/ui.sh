#!/bin/bash

# UI Helper functions for standardized prompts and output

source scripts/common.sh

# Function to prompt for a value with a default
prompt_default() {
    local prompt_text=$1
    local default_value=$2
    local result_var=$3
    
    read -p "${prompt_text} [${default_value}]: " user_input
    eval "${result_var}"='${user_input:-$default_value}'
}

# Function to prompt for a sensitive value (password)
prompt_secret() {
    local prompt_text=$1
    local result_var=$2
    
    read -s -p "${prompt_text}: " user_input
    echo
    eval "${result_var}"='$user_input'
}

# Function to display a menu and get selection
prompt_menu() {
    local title=$1
    local options=("${@:2}")
    local num_options=${#options[@]}
    
    echo -e "\n${title}" >&2
    for i in "${!options[@]}"; do
        echo "$((i+1))) ${options[i]}" >&2
    done
    
    local selection=""
    while [[ ! "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 1 ] || [ "$selection" -gt "$num_options" ]; do
        read -p "Selection [1-${num_options}]: " selection >&2
    done
    
    echo "$selection"
}
