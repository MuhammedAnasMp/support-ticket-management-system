import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "./store";

const PageTitle = () => {
    const location = useLocation();
    const user = useSelector((state: RootState) => state.auth.user);

    useEffect(() => {
        const role = user?.role ?? "Guest";

        let page = "Dashboard";

        if (location.pathname.startsWith("/tickets")) {
            page = "Tickets";
        } else if (location.pathname.startsWith("/stores")) {
            page = "Stores";
        } else if (location.pathname.startsWith("/maintenance")) {
            page = "Maintenance";
        } else if (location.pathname.startsWith("/workforce")) {
            page = "Workforce";
        } else if (location.pathname === "/login") {
            page = "Login";
        }

        // document.title = `${page} | ${role}`;
        document.title = `${role}`;
    }, [location.pathname, user]);

    return null;
};

export default PageTitle;