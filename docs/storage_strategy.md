# Zibaldone Storage Strategy

Zibaldone uses a robust, long-term storage strategy designed to handle millions of files over many years while maintaining high performance for discovery and discovery.

## 1. Physical Storage: Date-Based Hierarchy

To prevent filesystem performance issues and simplify archiving, Zibaldone organizes files into a date-based directory hierarchy.

### Structure
`[ROOT]/YYYY/MM/DD/[UUID].[EXT]`

- **Local Storage**: `[ROOT]` is defined by `STORAGE_DIR` (default: `data/blob_storage`).
- **S3 Storage**: `[ROOT]` is the bucket root.

### Benefits
- **Scalability**: Avoids "too many files in one directory" limits.
- **Predictability**: Makes manual navigation and backups predictable.
- **Archiving**: Allows for easy "folder-level" archiving (e.g., cold-storing all of 2024).

---

## 2. Database Model: `ContentItem`

The database serves as the high-speed index for all discovery and versioning.

### Key Fields
- `original_filename`: Used to link versions of the same file together.
- `version`: An incrementing integer (v1, v2, etc.) for each unique drop of the same filename.
- `content_type`: The MIME type for filtering (e.g., `application/pdf`).
- `checksum`: A SHA-256 hash of the content for data integrity and duplicate detection.
- `storage_path`: The relative path to the physical blob.
- `metadata_json`: Extracted tags and information from LLMs.

### Indexes
The following fields are indexed for high-performance filtering:
- `original_filename`
- `version`
- `content_type`
- `checksum`
- `created_at`

---

## 3. File Versioning: The Version Chain

When a file with the same name is uploaded again, Zibaldone creates a "Version Chain".

1. **Immutable Blobs**: Existing blobs are never overwritten. A new version gets its own UUID and its own date-based path.
2. **Version Increment**: The system automatically determines the next version number for that filename.
3. **Shadowing**: By default, discovery results only show the **latest version** of each unique filename.
4. **Historical Access**: Older versions remain in storage and the database, accessible via specific API flags.

---

## 4. API Usage

### Getting Upload Parameters
`GET /api/upload/params?filename=report.pdf`
Returns parameters for the upload, including the target `storage_path` (e.g., `2025/12/26/uuid.pdf`).

### Finalizing an Upload (S3/Direct)
`POST /api/upload/finalize`
Registers a successful direct upload in the database and assigns it a version.

### Fallback/Local Upload
`POST /api/upload`
Uploads file content directly to the backend. The backend handles checksum calculation and version assignment automatically.

### Listing and Filtering Items
`GET /api/items`

**Query Parameters:**
- `filename`: Filter by a specific filename.
- `content_type`: Filter by MIME type (e.g., `image/jpeg`).
- `after`: Filter for items created after a specific ISO date.
- `show_all_versions`: Set to `true` to disable shadowing and see every version of every file.

---

## 5. Storage Parity

The system ensures **perfect parity** between local development and cloud production.

- Both `FileSystemStorage` and `S3Storage` implement the `StorageInterface`.
- Both use the same `YYYY/MM/DD` prefixing utility.
- Switching between local and S3 requires zero changes to application code.
