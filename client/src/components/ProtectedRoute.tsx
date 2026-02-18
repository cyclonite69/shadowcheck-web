import React, { useEffect, useState } from 'react';
import { Redirect, Route } from 'react-router-dom';

const ProtectedRoute = ({ children, isAuthenticated, isLoading, ...rest }) => {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate checking authentication status
        setTimeout(() => {
            setLoading(false);
        }, 1000);
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <Route
            {...rest}
            render={() => {
                return isAuthenticated ? (children) : (<Redirect to="/login" />);
            }}
        />
    );
};

export default ProtectedRoute;