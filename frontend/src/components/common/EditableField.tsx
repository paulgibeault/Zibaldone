import React, { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';

interface EditableFieldProps {
    value: string;
    onSave: (newValue: string) => Promise<void> | void;
    className?: string; // For font styling mostly
    placeholder?: string;
    multiline?: boolean;
    style?: React.CSSProperties;
}

export const EditableField: React.FC<EditableFieldProps> = ({ 
    value, 
    onSave, 
    className = '', 
    placeholder = '', 
    multiline = false,
    style = {}
}) => {
    const [tempValue, setTempValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);
    
    // Reset temp value if external value changes (e.g. reload)
    useEffect(() => {
        setTempValue(value);
    }, [value]);

    const hasChanged = tempValue !== value;

    const handleSave = async () => {
        if (!hasChanged) return;
        setIsSaving(true);
        try {
            await onSave(tempValue);
        } catch (error) {
            console.error("Failed to save:", error);
            // Optionally revert or show error, for now we just keep the temp value so user can retry
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setTempValue(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape' && hasChanged) {
            handleCancel();
        }
        // For single line, enter saves. For multiline, enter is new line (or Ctrl+Enter could save, but keep simple for now)
        if (!multiline && e.key === 'Enter' && hasChanged) {
            handleSave();
        }
    };

    const [inputWidth, setInputWidth] = useState<string | number>('100%');
    const measureRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!multiline && measureRef.current) {
            // Measure text width + padding for buttons
            // Padding right is 3.5rem (~56px) + let's add buffer
            const textWidth = measureRef.current.offsetWidth;
            const padding = 70; // 3.5rem is 56px, plus 0.5rem left is 8px. ~64px. + buffer.
            setInputWidth(Math.max(textWidth + padding, 150)); // Min width 150px
        }
    }, [tempValue, multiline]);

    // Shared styles for input/textarea
    const inputStyles: React.CSSProperties = {
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: '4px',
        // Critical: padding-right must accommodate the buttons
        padding: multiline ? '0.5rem 3.5rem 0.5rem 0.5rem' : '0.2rem 3.5rem 0.2rem 0.5rem',
        marginLeft: '-0.5rem', // Visual alignment adjust
        width: multiline ? '100%' : inputWidth,
        maxWidth: '100%',
        outline: 'none',
        transition: 'border-color 0.2s',
        ...style
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.target.style.borderColor = 'var(--primary)';
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        // Only clear border if we aren't clicking strictly another focusable element 
        // But more importantly, we want to visually revert the border if not focused.
        // The tricky part is if we click the "Save" button, we don't want the visual jump.
        // Actually, just simple logic:
        e.target.style.borderColor = 'transparent';
    };
    
    // We used mouse enter/leave for hover borders in the previous code, 
    // but standard :hover / :focus-visible CSS pseudo-classes are better practice if we can used a wrapper.
    // However, to maintain exact previous behavior:
    const handleMouseEnter = (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (document.activeElement !== e.target) {
            (e.target as HTMLElement).style.borderColor = 'var(--border-subtle)';
        }
    };
    const handleMouseLeave = (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (document.activeElement !== e.target) {
            (e.target as HTMLElement).style.borderColor = 'transparent';
        }
    };

    return (
        <div style={{ position: 'relative', width: multiline ? '100%' : 'fit-content', maxWidth: '100%' }}>
            {!multiline && (
                <span 
                    ref={measureRef} 
                    className={className} 
                    style={{ 
                        visibility: 'hidden', 
                        position: 'absolute', 
                        whiteSpace: 'pre',
                        pointerEvents: 'none',
                        ...style 
                    }}
                >
                    {tempValue || placeholder}
                </span>
            )}

            {multiline ? (
                <textarea
                    className={className}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    style={{
                        ...inputStyles,
                        fontFamily: 'inherit',
                        resize: 'none',
                        minHeight: '60px',
                    }}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                />
            ) : (
                <input
                    className={className}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    style={inputStyles}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                />
            )}

            {hasChanged && (
                <div style={{
                    position: 'absolute',
                    right: '4px',
                    top: multiline ? '10px' : '50%',
                    transform: multiline ? 'none' : 'translateY(-50%)',
                    display: 'flex',
                    gap: '4px',
                    zIndex: 10
                }}>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        title="Save"
                        style={{
                            background: '#22c55e', // Green
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isSaving ? 'wait' : 'pointer',
                            padding: 0,
                            opacity: isSaving ? 0.7 : 1
                        }}
                    >
                        <Check size={14} />
                    </button>
                    <button 
                        onClick={handleCancel}
                        disabled={isSaving}
                        title="Discard"
                        style={{
                            background: '#ef4444', // Red
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            padding: 0
                        }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};
