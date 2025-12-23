import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '../api';

interface DropZoneProps {
    onUploadComplete: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onUploadComplete }) => {
    const [uploadError, setUploadError] = React.useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setUploadError(null); // Clear previous errors
        for (const file of acceptedFiles) {
            try {
                const metadata = {
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    lastModifiedDate: new Date(file.lastModified).toISOString()
                };
                await uploadFile(file, metadata);
                console.log(`Uploaded ${file.name}`);
            } catch (error: any) {
                console.error(`Error uploading ${file.name}:`, error);
                let errorMessage = `Failed to upload ${file.name}.`;
                if (error.code === 'ECONNABORTED') {
                    errorMessage += ' Request timed out. Backend may be unreachable.';
                } else if (error.message) {
                    errorMessage += ` ${error.message}`;
                }
                setUploadError(errorMessage);
                // Also show alert to ensure visibility
                alert(errorMessage);
            }
        }
        onUploadComplete();
    }, [onUploadComplete]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    return (
        <div className="dropzone-container">
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''} ${uploadError ? 'error' : ''}`}>
                <input {...getInputProps()} />
                {isDragActive ? (
                    <p>Drop the files here ...</p>
                ) : (
                    <p>Drag 'n' drop some files here, or click to select files</p>
                )}
            </div>
            {uploadError && (
                <div className="error-message" style={{ color: 'red', marginTop: '10px' }}>
                    {uploadError}
                </div>
            )}
        </div>
    );
};
