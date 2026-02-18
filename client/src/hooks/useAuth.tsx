import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';

const useAuth = () => {
    const history = useHistory();

    useEffect(() => {
        const handleWindowFocus = () => {
            // Session re-validation logic here
            console.log('Window focused, re-validating session...');
            // Call your session validation function
        };

        window.addEventListener('focus', handleWindowFocus);

        return () => {
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, []);

    useEffect(() => {
        const unlisten = history.listen((location) => {
            // Session re-validation logic on route change
            console.log('Route changed to:', location.pathname);
            // Call your session validation function
        });

        return () => {
            unlisten();
        };
    }, [history]);
};

export default useAuth;
