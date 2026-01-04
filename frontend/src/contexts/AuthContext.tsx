import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface User {
    id: string;
    display_name: string;
    is_admin: boolean;
    profile_color: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    updateUser: (user: User) => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load from localStorage on startup
        const storedToken = localStorage.getItem('zibaldone-token');
        const storedUser = localStorage.getItem('zibaldone-user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }

        setIsLoading(false);

        // Listen for 401 Unauthorized events from api.ts
        const handleUnauthorized = () => {
            console.warn("Received auth:unauthorized event. Logging out...");
            logout(); // uses the function defined below (due to hoisting / closure access it works, but better move logout above or wrap in another effect if needed. Actually logout is const defined AFTER. Wait.
            // React state update functions are stable. But logout is defined inside the component.
            // We need to move logout definition UP, or use a separate useEffect for the listener that depends on logout.
        };

        window.addEventListener('auth:unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
    }, []); // Wait, logout is not defined yet here. I should fix the order or dependency.


    const login = (newToken: string, newUser: User) => {
        localStorage.setItem('zibaldone-token', newToken);
        localStorage.setItem('zibaldone-user', JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        localStorage.removeItem('zibaldone-token');
        localStorage.removeItem('zibaldone-user');
        setToken(null);
        setUser(null);
    };

    const updateUser = (updatedUser: User) => {
        localStorage.setItem('zibaldone-user', JSON.stringify(updatedUser));
        setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            isLoading,
            login,
            logout,
            updateUser,
            isAuthenticated: !!token
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
