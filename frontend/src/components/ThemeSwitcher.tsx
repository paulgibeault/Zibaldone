import { useEffect, useState, useRef } from 'react';
import { Monitor, Sun, Moon, Droplets, Leaf, ChevronDown } from 'lucide-react';
import './ThemeSwitcher.css';

type Theme = 'light' | 'dark' | 'ocean' | 'forest';
type ThemeOption = Theme | 'system';

interface ThemeConfig {
    id: ThemeOption;
    label: string;
    icon: React.ReactNode;
}

export function ThemeSwitcher() {
    const [theme, setTheme] = useState<ThemeOption>('system');
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const themes: ThemeConfig[] = [
        { id: 'system', label: 'System', icon: <Monitor size={16} /> },
        { id: 'light', label: 'Light', icon: <Sun size={16} /> },
        { id: 'dark', label: 'Dark', icon: <Moon size={16} /> },
        { id: 'ocean', label: 'Ocean', icon: <Droplets size={16} /> },
        { id: 'forest', label: 'Forest', icon: <Leaf size={16} /> },
    ];

    useEffect(() => {
        const root = document.documentElement;
        // Remove all previous data-theme attributes
        root.removeAttribute('data-theme');

        if (theme !== 'system') {
            root.setAttribute('data-theme', theme);
        } else {
            // Handle system theme changes if needed, 
            // though CSS media queries preference-color-scheme often handle the basics.
            // For full JS control over system theme sync, more logic is needed,
            // but simply removing the attribute lets CSS fallback to system or default.
        }
    }, [theme]);

    useEffect(() => {
        // Close dropdown when clicking outside
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const currentTheme = themes.find(t => t.id === theme) || themes[0];

    return (
        <div className="theme-switcher" ref={dropdownRef}>
            <button
                className="theme-toggle-btn"
                onClick={() => setIsOpen(!isOpen)}
                aria-label={`Select theme (current: ${currentTheme.label})`}
                title={`Current theme: ${currentTheme.label}`}
            >
                {currentTheme.icon}
                <ChevronDown size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
            </button>

            {isOpen && (
                <div className="theme-dropdown">
                    {themes.map((t) => (
                        <button
                            key={t.id}
                            className={`theme-option ${theme === t.id ? 'active' : ''}`}
                            onClick={() => {
                                setTheme(t.id);
                                setIsOpen(false);
                            }}
                            title={t.label}
                            aria-label={t.label}
                        >
                            {t.icon}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
