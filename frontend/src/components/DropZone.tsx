import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '../api';

interface DropZoneProps {
    onUploadComplete: () => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onUploadComplete }) => {
    const [uploadError, setUploadError] = React.useState<string | null>(null);

    const getImageMetadata = (file: File): Promise<any> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(img.src);
                resolve({ width: img.width, height: img.height });
            };
            img.onerror = () => {
                URL.revokeObjectURL(img.src);
                resolve({});
            };
            img.src = URL.createObjectURL(file);
        });
    };

    const getVideoMetadata = (file: File): Promise<any> => {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                URL.revokeObjectURL(video.src);
                resolve({
                    duration: video.duration,
                    width: video.videoWidth,
                    height: video.videoHeight
                });
            };
            video.onerror = () => {
                URL.revokeObjectURL(video.src);
                resolve({});
            };
            video.src = URL.createObjectURL(file);
        });
    };

    const getAudioMetadata = (file: File): Promise<any> => {
        return new Promise((resolve) => {
            const audio = document.createElement('audio');
            audio.preload = 'metadata';
            audio.onloadedmetadata = () => {
                URL.revokeObjectURL(audio.src);
                resolve({ duration: audio.duration });
            };
            audio.onerror = () => {
                URL.revokeObjectURL(audio.src);
                resolve({});
            };
            audio.src = URL.createObjectURL(file);
        });
    };

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        setUploadError(null); // Clear previous errors
        for (const file of acceptedFiles) {
            try {
                let extraMetadata = {};

                if (file.type.startsWith('image/')) {
                    extraMetadata = await getImageMetadata(file);
                } else if (file.type.startsWith('video/')) {
                    extraMetadata = await getVideoMetadata(file);
                } else if (file.type.startsWith('audio/')) {
                    extraMetadata = await getAudioMetadata(file);
                }

                const metadata = {
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    lastModifiedDate: new Date(file.lastModified).toISOString(),
                    ...extraMetadata
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

    // We want the whole area to be a drop zone, but only the logo to be clickable for the file picker.
    // However, the user said "Clicking the logo does not bring up the file picker like the old drop-zone did"
    // implies they WANT it to bring up the picker.
    // BUT, Dropzone default is the whole div is clickable. If I remove noClick: true, the whole title bar will be clickable.
    // I will enable click on the logo only.
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        noClick: true // Disable click on root, we will attach it manually to the logo
    });

    return (
        <div className="header-dropzone-container" {...getRootProps()}>
            <input {...getInputProps()} />

            {/* The Logo is the main visual element of the drop zone */}
            {/* Added onClick={open} to make just the logo trigger the file picker */}
            <div
                className={`app-logo ${isDragActive ? 'dragging' : ''}`}
                role="button"
                aria-label="Zibaldone Logo - Click to Upload"
                onClick={open}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') open(); }}
            />

            {/* Subtle Footer Instructions */}
            <div className="dropzone-footer">
                {uploadError ? (
                    <span className="error-text">{uploadError}</span>
                ) : isDragActive ? (
                    <span className="active-text">Drop files now...</span>
                ) : (
                    <span>Drag and drop to upload</span>
                )}
            </div>
        </div>
    );
};
