import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadFile } from '../api';
import { IdentityConflictModal } from './IdentityConflictModal';

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

    const calculateChecksum = async (file: File): Promise<string> => {
        try {
            // Limit checksum calculation to 500MB to avoid memory issues
            if (file.size > 500 * 1024 * 1024) {
                console.warn("File too large for client-side checksum, skipping.");
                return "";
            }
            const buffer = await file.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            return hashHex;
        } catch (e) {
            console.error("Error calculating checksum:", e);
            return "";
        }
    };

    const getFileSignature = async (file: File): Promise<string | null> => {
        // Only try to read signature for small-ish files and text/markdown/code types
        // This is a heuristic to distinguish README.md files from different projects
        if (file.size > 1024 * 1024) return null; // Skip > 1MB

        const type = file.type || '';
        // Heuristic: if type is text/* or name ends in .md, .txt, .py, .js, .json etc.
        const isText = type.startsWith('text/') ||
            /\.(md|txt|py|js|ts|tsx|jsx|json|html|css|yaml|yml|xml|csv)$/i.test(file.name);

        if (!isText) return null;

        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/);
            // Find first non-empty line
            for (const line of lines) {
                const trimmed = line.trim();
                // Avoid tiny snippets, look for something substantial or a header
                if (trimmed.length > 3) {
                    // Limit signature length
                    return trimmed.substring(0, 100);
                }
            }
        } catch (e) {
            // Ignore encoding errors etc
        }
        return null;
    };

    const [conflictModalOpen, setConflictModalOpen] = React.useState(false);
    const [conflictFile, setConflictFile] = React.useState<{ file: File, metadata: any } | null>(null);

    const onResolveConflict = async (resolution: 'new_version' | 'new_file') => {
        if (!conflictFile) return;

        try {
            await uploadFile(conflictFile.file, conflictFile.metadata, resolution);
            console.log(`Resolved conflict for ${conflictFile.file.name} as ${resolution}`);
            setConflictModalOpen(false);
            setConflictFile(null);
            onUploadComplete();
        } catch (error: any) {
            console.error(`Error uploading resolved file ${conflictFile.file.name}:`, error);
            setUploadError(`Failed to upload ${conflictFile.file.name} after resolution.`);
        }
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

                const checksum = await calculateChecksum(file);
                const signature = await getFileSignature(file);

                // Use webkitRelativePath if available (folder upload), otherwise fallback to name.
                // NOTE: standard file drag gives empty path.
                const filePath = file.webkitRelativePath || (file as any).path || file.name;

                const metadata = {
                    size: file.size,
                    type: file.type,
                    checksum: checksum,
                    lastModified: file.lastModified,
                    lastModifiedDate: new Date(file.lastModified).toISOString(),
                    ...extraMetadata,
                    client_context: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                        origin: window.location.origin,
                        filePath: filePath,
                        signature: signature // Send the heuristic signature
                    }
                };
                try {
                    await uploadFile(file, metadata);
                    console.log(`Uploaded ${file.name}`);
                } catch (error: any) {
                    // Check for 409 Conflict
                    if (error.response && error.response.status === 409) {
                        console.log("Identity Conflict detected for", file.name);
                        setConflictFile({ file, metadata });
                        setConflictModalOpen(true);
                        return; // Stop processing this file, wait for user input
                    }
                    throw error; // Re-throw other errors
                }
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

    // ... (rest of hook calls) ...
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        noClick: true
    });

    return (
        <>
            <div className="header-dropzone-container" {...getRootProps()}>
                <input {...getInputProps()} />

                {/* The Logo is the main visual element of the drop zone */}
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

            <IdentityConflictModal
                isOpen={conflictModalOpen}
                fileName={conflictFile?.file.name || ''}
                onResolve={onResolveConflict}
                onCancel={() => {
                    setConflictModalOpen(false);
                    setConflictFile(null);
                }}
            />
        </>
    );
};
