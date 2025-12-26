#!/bin/bash

CONFIG_FILE=".zibaldone.conf"

load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
    else
        export ZIB_MODE=""
    fi
}

save_config() {
    cat > "$CONFIG_FILE" <<EOL
ZIB_MODE="$ZIB_MODE"
# Add other global configs here if needed
EOL
}

set_mode() {
    export ZIB_MODE="$1"
    save_config
}

get_mode() {
    load_config
    echo "$ZIB_MODE"
}
