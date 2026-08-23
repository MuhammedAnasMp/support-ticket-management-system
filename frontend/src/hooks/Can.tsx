import { useEffect, useState } from "react";
import { usePermission } from "./usePermission";
import permissions from "./default_permissions.json";

export type PermissionKey = keyof typeof permissions.permission_definitions;

interface CanProps {
    permission: PermissionKey | PermissionKey[] | boolean;
    children: React.ReactNode;

    // Optional: yellow badge instead of red
    isSuggestedPermission?: boolean;

    // Optional: custom CSS classes for the wrapper element
    className?: string;
}

// Global developer mode state
export let permissionDebugEnabled = false;

// 1. Move the keydown listener to the global module scope
// This ensures it only runs ONCE, no matter how many <Can> components are rendered.
if (typeof window !== "undefined") {
    window.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "z") {
            permissionDebugEnabled = !permissionDebugEnabled;
            window.dispatchEvent(new CustomEvent("permission-debug-toggle"));
        }
    });
}

function Can({
    permission,
    children,
    isSuggestedPermission = false,
    className = "",
}: CanProps) {
    const { hasPermission } = usePermission();

    const [copied, setCopied] = useState(false);
    const [showDebug, setShowDebug] = useState(permissionDebugEnabled);

    // 2. Only listen for the custom toggle event inside the component
    useEffect(() => {
        const handleToggle = () => {
            setShowDebug(permissionDebugEnabled);
        };

        window.addEventListener("permission-debug-toggle", handleToggle);

        return () => {
            window.removeEventListener("permission-debug-toggle", handleToggle);
        };
    }, []);

    let allowed = false;

    if (typeof permission === "boolean") {
        allowed = permission;
    } else {
        const permissionsList = Array.isArray(permission)
            ? permission
            : [permission];

        allowed = permissionsList.some((p) => hasPermission(p));
    }

    const displayValue =
        typeof permission === "boolean"
            ? permission.toString()
            : (Array.isArray(permission)
                ? permission
                : [permission]
            ).join(",");

    const copyValue =
        typeof permission === "boolean"
            ? permission.toString()
            : (Array.isArray(permission)
                ? permission
                : [permission]
            )
                .map((value) =>
                    value.split(".").pop()!.replace(/_/g, " ")
                )
                .join(", ");

    const copyPermission = async (e: React.MouseEvent) => {
        e.stopPropagation();

        try {
            await navigator.clipboard.writeText(copyValue);

            setCopied(true);

            setTimeout(() => {
                setCopied(false);
            }, 1500);
        } catch (error) {
            console.error(error);
        }
    };

    const badgeColor = isSuggestedPermission
        ? "bg-yellow-400 text-black"
        : "bg-red-600 text-white";

    /**
     * PRODUCTION MODE
     * No permission => render nothing
     */
    if (!showDebug && !allowed) {
        return null;
    }

    /**
     * ALLOWED
     */
    if (allowed) {
        if (!showDebug) {
            if (className) {
                return (
                    <div
                        className={className}
                        data-permission={displayValue}
                    >
                        {children}
                    </div>
                );
            }
            return <>{children}</>;
        }

        const wrapperClass = className ? className : "inline-block";

        return (
            <div
                className={`
                    relative
                    group
                    ${wrapperClass}
                    ${showDebug
                        ? "border-2 border-green-500"
                        : ""
                    }
                `}
                data-permission={displayValue}
            >
                {children}

                {showDebug && (
                    <>
                        {/* Permission Badge */}
                        <div
                            onClick={copyPermission}
                            className={`
                                absolute
                                -top-2
                                -right-2
                                w-5
                                h-5
                                rounded-full
                                bg-green-600
                                text-white
                                text-xs
                                font-bold
                                flex
                                items-center
                                justify-center
                                cursor-pointer
                                z-[10001]
                                shadow-md
                            `}
                            title="Permission"
                        >
                            ✓
                        </div>

                        {/* Tooltip */}
                        <div
                            onClick={copyPermission}
                            className="
                                absolute
                                bottom-full
                                left-1/2
                                -translate-x-1/2
                                mb-1
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
                            {copied ? "Copied!" : displayValue}
                        </div>
                    </>
                )}
            </div>
        );
    }

    /**
     * DENIED
     * Only visible when developer mode is ON
     */
    return (
        <div
            className={`
                relative
                group
                opacity-50
                border-2
                border-red-500
                ${className ? className : "inline-block"}
            `}
        >
            {children}

            {/* Permission Badge */}
            <div
                onClick={copyPermission}
                className={`
                    absolute
                    -top-2
                    -right-2
                    w-5
                    h-5
                    rounded-full
                    text-xs
                    font-bold
                    flex
                    items-center
                    justify-center
                    cursor-pointer
                    z-[10001]
                    shadow-md
                    ${badgeColor}
                `}
                title="Required Permission"
            >
                !
            </div>

            {/* Tooltip */}
            <div
                onClick={copyPermission}
                className="
                    absolute
                    bottom-full
                    left-1/2
                    -translate-x-1/2
                    mb-1
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
                {copied ? "Copied!" : `Required: ${displayValue}`}
            </div>
        </div>
    );
}

export default Can;