export interface Tag {
    id: string;
    name: string;
    color: string;
    is_autocreated: boolean;
    is_approved: boolean;
    created_at: string;
}

export interface ProcessingTask {
    id: string;
    item_id: string;
    name: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    message?: string;
    start_time: string;
    end_time?: string;
    result_json?: string;
}

export interface ContentItem {
    id: string;
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    original_filename: string;
    storage_path: string;
    created_at: string;
    metadata_json: string;
    download_url?: string;
    version: number;
    client_file_path?: string;
    tags: Tag[];
    tasks: ProcessingTask[];
}

export interface SearchResponse {
    tags: Tag[];
    items: ContentItem[];
}
