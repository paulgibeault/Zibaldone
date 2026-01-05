import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
    width?: string;
    showCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    width = '600px',
    showCloseButton = true
}) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Handle click outside
    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === overlayRef.current) {
            onClose();
        }
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div
            className="modal-overlay"
            ref={overlayRef}
            onClick={handleOverlayClick}
            aria-modal="true"
            role="dialog"
        >
            <div className="modal-content" style={{ width }}>
                {(title || showCloseButton) && (
                    <div className="modal-header">
                        {title && <h2>{title}</h2>}
                        {showCloseButton && (
                            <button
                                className="modal-close-btn"
                                onClick={onClose}
                                aria-label="Close modal"
                            >
                                &times;
                            </button>
                        )}
                    </div>
                )}
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
};
