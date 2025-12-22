import { useEffect, useState } from 'react';
import './ThemeSwitcher.css';

type Theme = 'light' | 'dark' | 'ocean' | 'forest';

export function ThemeSwitcher() {
    const [theme, setTheme] = useState<Theme | 'system'>('system');

    useEffect(() => {
        const root = document.documentElement;
        // Remove all previous data-theme attributes
        root.removeAttribute('data-theme');

        if (theme !== 'system') {
            root.setAttribute('data-theme', theme);
        }
    }, [theme]);

    return (
        <div className="theme-switcher">
            <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                className="theme-select"
            >
                <option value="system">System Default</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="ocean">Ocean</option>
                <option value="forest">Forest</option>
            </select>
        </div>
    );
}
