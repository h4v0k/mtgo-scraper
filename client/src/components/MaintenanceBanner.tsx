import React from 'react';
import './MaintenanceBanner.css';

export const MaintenanceBanner: React.FC = () => {
    return (
        <div className="maintenance-overlay">
            <div className="maintenance-content">
                <div className="maintenance-icon">🚧</div>
                <h1>Under Construction</h1>
                <p className="maintenance-message">
                    We're currently performing critical database maintenance.
                </p>
                <p className="maintenance-details">
                    The site will be back online shortly with full functionality restored.
                    We apologize for any inconvenience.
                </p>
                <div className="maintenance-status">
                    <span className="status-dot"></span>
                    Data preservation in progress
                </div>
            </div>
        </div>
    );
};
