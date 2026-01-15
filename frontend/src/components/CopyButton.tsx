import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import './CopyButton.css';

interface CopyButtonProps {
    text: string;
    className?: string;
    children?: React.ReactNode;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, className = '', children }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className={`copy-button-container ${className}`}>
            {children}
            <button
                className={`copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
                title="Copy to clipboard"
                aria-label="Copy to clipboard"
            >
                {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
        </div>
    );
};
