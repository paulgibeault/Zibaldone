import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '../api';

interface DropZoneProps {
    onUploadComplete: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onUploadComplete }) => {
    const onDrop = useCallback(async (acceptedFiles: File[]) => {
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
            } catch (error) {
                console.error(`Error uploading ${file.name}:`, error);
            }
        }
        onUploadComplete();
    }, [onUploadComplete]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

    return (
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            {isDragActive ? (
                <p>Drop the files here ...</p>
            ) : (
                <p>Drag 'n' drop some files here, or click to select files</p>
            )}
        </div>
    );
};
