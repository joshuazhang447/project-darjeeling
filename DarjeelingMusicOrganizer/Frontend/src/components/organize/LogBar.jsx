import React from 'react';


const LogBar = ({
    status = 'ready',
    message = "Press 'Import/Refresh' to scan directory, update the library structure, and generate a backup point.",
    errorMessage = null,
    details = { memory: 'Idle' }
}) => {

    const getStatusBadge = () => {
        switch (status) {
            case 'ready':
                return (
                    <span className="text-[#eebb4d] font-bold">[Ready]</span>
                );
            case 'scanning':
                return (
                    <span className="text-[#88c9a1] font-bold flex items-center gap-1">
                        <i className="fa-solid fa-magnifying-glass animate-pulse"></i>
                        [Scanning]
                    </span>
                );
            case 'working':
                return (
                    <span className="text-[#88c9a1] font-bold flex items-center gap-1">
                        <i className="fa-solid fa-gear animate-spin"></i>
                        [Working]
                    </span>
                );
            case 'error':
                return (
                    <span className="text-[#e74c3c] font-bold">[Error]</span>
                );
            case 'success':
                return (
                    <span className="text-[#88c9a1] font-bold flex items-center gap-1">
                        <i className="fa-solid fa-check"></i>
                        [Done]
                    </span>
                );
            default:
                return (
                    <span className="text-[#eebb4d] font-bold">[Ready]</span>
                );
        }
    };



    const getStatusIndicator = () => {
        switch (status) {
            case 'scanning':
            case 'working':
                return (
                    <span className="flex items-center gap-1">
                        <i className="fa-solid fa-spinner animate-spin mr-1"></i>
                        Working
                    </span>
                );
            case 'error':
                return (
                    <span className="text-[#e74c3c]">
                        <i className="fa-solid fa-exclamation-triangle mr-1"></i>
                        Error
                    </span>
                );
            case 'success':
                return (
                    <span className="text-[#88c9a1]">
                        <i className="fa-solid fa-check mr-1"></i>
                        Complete
                    </span>
                );
            default:
                return (
                    <span>
                        <i className="fa-solid fa-memory mr-1"></i>
                        {details?.memory || 'Idle'}
                    </span>
                );
        }
    };

    return (
        <div className="h-8 bg-[#fffefb] border-t border-[#e8e3d3] flex items-center px-4 gap-3 text-xs font-mono shrink-0 relative z-20">

            {getStatusBadge()}


            {errorMessage ? (
                <span className="text-[#e74c3c] truncate font-semibold">{errorMessage}</span>
            ) : (
                <span className="text-[#5c4b37] truncate">{message}</span>
            )}


            <div className="flex-1"></div>


            <div className="flex gap-4 text-[10px] font-bold text-[#9c8b77] shrink-0">
                {getStatusIndicator()}
            </div>
        </div>
    );
};

export default LogBar;
