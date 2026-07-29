import { useState } from "react";
import { usePermission } from "./usePermission";
import permissions from "./default_permissions.json";

type PermissionKey = keyof typeof permissions.permission_definitions;

interface CanProps {
    permission: PermissionKey | PermissionKey[] | boolean;
    children: React.ReactNode;
}

function Can({ permission, children }: CanProps) {
    const { hasPermission } = usePermission();
    const [copied, setCopied] = useState(false);

    let allowed = false;

    if (typeof permission === "boolean") {
        allowed = permission;
    } else {
        const permissionsList = Array.isArray(permission)
            ? permission
            : [permission];

        allowed = permissionsList.some((p) => hasPermission(p));
    }

    if (!allowed) return null;

    const permissionValue =
        typeof permission === "boolean"
            ? permission.toString()
            : (Array.isArray(permission) ? permission : [permission]).join(",");

    const copyPermission = async (e: React.MouseEvent) => {
        e.stopPropagation();

        await navigator.clipboard.writeText(permissionValue);

        setCopied(true);

        setTimeout(() => {
            setCopied(false);
        }, 1500);
    };

    return (
        <div
            className="relative inline-block group border-amber-700 border-2"
            data-permission={permissionValue}
        >
            {children}

            <div
                onClick={copyPermission}
                className="
        absolute
        bottom-full
        left-1/2
        -translate-x-1/2
        mb-0
        hidden
        group-hover:block
        cursor-pointer
        rounded-md
        bg-black
        px-3
        py-1
        text-sm
        text-white
        whitespace-nowrap
        z-[10000]
    "
            >
                {copied ? "Copied!" : permissionValue}
            </div>
        </div>
    );
}

export default Can;