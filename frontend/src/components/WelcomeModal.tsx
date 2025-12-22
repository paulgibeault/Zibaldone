import { useState, useEffect } from 'react';
import './WelcomeModal.css';

export function WelcomeModal() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
        if (!hasSeenWelcome) {
            setIsOpen(true);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem('hasSeenWelcome', 'true');
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div className="welcome-modal-overlay">
            <div className="welcome-modal">
                <h2>Welcome to Zibaldone</h2>
                <p>
                    Your personal intellectual archive.
                    <br /><br />
                    Drag and drop files to begin processing.
                    Ensure your Local LLM Server is running for automatic tagging.
                </p>
                <button onClick={handleClose}>Get Started</button>
            </div>
        </div>
    );
}
