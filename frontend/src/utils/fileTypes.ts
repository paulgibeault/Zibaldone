import {
    FileText,
    FileImage,
    FileCode,
    FileAudio,
    FileVideo,
    Archive,
    File,
    type LucideIcon
} from 'lucide-react';

export type FileCategory = 'image' | 'video' | 'audio' | 'code' | 'archive' | 'text' | 'pdf' | 'default';

export const getFileCategory = (contentType: string = '', filename: string = ''): FileCategory => {
    const type = contentType.toLowerCase();
    const name = filename.toLowerCase();

    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'audio';
    if (type === 'application/pdf') return 'pdf';

    if (type.includes('javascript') || type.includes('python') || type.includes('json') || type.includes('html') || type.includes('css')) {
        return 'code';
    }

    if (type.includes('zip') || type.includes('tar') || type.includes('gzip')) return 'archive';

    if (type.includes('text/') || type.includes('markdown') || name.endsWith('.txt') || name.endsWith('.md')) {
        return 'text';
    }

    if (['license', 'copying', 'unlicense', 'makefile', 'dockerfile', 'gemfile'].includes(name)) {
        return 'text';
    }

    return 'default';
};

export const getFileIcon = (category: FileCategory): LucideIcon => {
    switch (category) {
        case 'image': return FileImage;
        case 'video': return FileVideo;
        case 'audio': return FileAudio;
        case 'code': return FileCode;
        case 'archive': return Archive;
        case 'text': return FileText;
        default: return File;
    }
};

export const isPreviewable = (category: FileCategory): boolean => {
    return ['image', 'video', 'audio', 'pdf', 'text', 'code'].includes(category);
};

export const isTextBased = (category: FileCategory): boolean => {
    return ['text', 'code'].includes(category);
};
