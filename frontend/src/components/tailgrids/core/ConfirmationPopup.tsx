import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { X, AlertCircle, AlertTriangle, HelpCircle, Info } from "lucide-react";

export type ConfirmPopupVariant = "primary" | "danger" | "warning" | "info";

export const CONFIRM_PRESETS = {
    general: {
        title: "Confirm Action",
        description: "Are you sure you want to confirm this action and continue?",
        button1: "Cancel",
        button2: "Confirm",
        variant: "primary" as ConfirmPopupVariant,
    },
    nature: {
        title: "Change Nature",
        description: "Are you sure you want to change the nature of this ticket?",
        button1: "Cancel",
        button2: "Change Nature",
        variant: "primary" as ConfirmPopupVariant,
    },
    priority: {
        title: "Change Priority",
        description: "Are you sure you want to change the priority of this ticket?",
        button1: "Cancel",
        button2: "Change Priority",
        variant: "primary" as ConfirmPopupVariant,
    },
    status: {
        title: "Change Status",
        description: "Are you sure you want to change the status of this ticket?",
        button1: "Cancel",
        button2: "Change Status",
        variant: "primary" as ConfirmPopupVariant,
    },
    delete: {
        title: "Delete Confirmation",
        description: "Are you sure you want to delete this item? This action cannot be undone.",
        button1: "Cancel",
        button2: "Delete",
        variant: "danger" as ConfirmPopupVariant,
    },
    remove: {
        title: "Remove Item",
        description: "Are you sure you want to remove this item?",
        button1: "Cancel",
        button2: "Remove",
        variant: "danger" as ConfirmPopupVariant,
    },
    discard: {
        title: "Discard Changes",
        description: "Are you sure you want to discard your unsaved changes?",
        button1: "Keep Editing",
        button2: "Discard",
        variant: "warning" as ConfirmPopupVariant,
    },
    save: {
        title: "Save Changes",
        description: "Are you sure you want to save these changes?",
        button1: "Cancel",
        button2: "Save",
        variant: "primary" as ConfirmPopupVariant,
    },
    complete: {
        title: "Mark as Completed",
        description: "Are you sure you want to mark this as completed?",
        button1: "Cancel",
        button2: "Complete",
        variant: "primary" as ConfirmPopupVariant,
    },
    cancel: {
        title: "Cancel Action",
        description: "Are you sure you want to cancel? Any unsaved changes will be lost.",
        button1: "No, Keep",
        button2: "Yes, Cancel",
        variant: "warning" as ConfirmPopupVariant,
    },
    approve: {
        title: "Approve Request",
        description: "Are you sure you want to approve this request?",
        button1: "Cancel",
        button2: "Approve",
        variant: "primary" as ConfirmPopupVariant,
    },
    reject: {
        title: "Reject Request",
        description: "Are you sure you want to reject this request?",
        button1: "Cancel",
        button2: "Reject",
        variant: "danger" as ConfirmPopupVariant,
    },
    reopen: {
        title: "Reopen Ticket",
        description: "Are you sure you want to reopen this ticket?",
        button1: "Cancel",
        button2: "Reopen",
        variant: "primary" as ConfirmPopupVariant,
    },
    archive: {
        title: "Archive Item",
        description: "Are you sure you want to archive this item?",
        button1: "Cancel",
        button2: "Archive",
        variant: "warning" as ConfirmPopupVariant,
    },
    logout: {
        title: "Sign Out",
        description: "Are you sure you want to sign out?",
        button1: "Cancel",
        button2: "Sign Out",
        variant: "danger" as ConfirmPopupVariant,
    },
};

const PRESET_ALIASES: Record<string, keyof typeof CONFIRM_PRESETS> = {
    default: "general",
    action: "general",
    continue: "general",
    changenature: "nature",
    changepriority: "priority",
    changestatus: "status",
    discardchanges: "discard",
    signout: "logout",
    finish: "complete",
    abort: "cancel",
    accept: "approve",
    decline: "reject",
};

export type ConfirmPreset =
    | keyof typeof CONFIRM_PRESETS
    | "default"
    | "action"
    | "continue"
    | "change_nature"
    | "change_priority"
    | "change_status"
    | "discard_changes"
    | "signout"
    | "finish"
    | "abort"
    | "accept"
    | "decline";

export type ConfirmPopupOptions = {
    preset?: ConfirmPreset | (string & {});
    title?: string;
    description?: string;
    button1?: string;
    button2?: string;
    variant?: ConfirmPopupVariant;
    icon?: React.ReactNode;
    showButton1?: boolean;
};

export type ConfirmPopupArg = ConfirmPreset | (string & {}) | ConfirmPopupOptions;

function resolveOptions(arg?: ConfirmPopupArg): ConfirmPopupOptions {
    if (!arg) {
        return { ...CONFIRM_PRESETS.general };
    }

    if (typeof arg === "string") {
        const key = arg.toLowerCase().replace(/[-_\s]+/g, "");
        const matchedKey = (CONFIRM_PRESETS as any)[key]
            ? (key as keyof typeof CONFIRM_PRESETS)
            : PRESET_ALIASES[key];
        if (matchedKey && CONFIRM_PRESETS[matchedKey]) {
            return { ...CONFIRM_PRESETS[matchedKey] };
        }
        return {
            title: "Confirmation",
            description: arg,
            button1: "Cancel",
            button2: "Confirm",
        };
    }

    if (arg.preset) {
        const key = arg.preset.toLowerCase().replace(/[-_\s]+/g, "");
        const matchedKey = (CONFIRM_PRESETS as any)[key]
            ? (key as keyof typeof CONFIRM_PRESETS)
            : PRESET_ALIASES[key];
        const base = matchedKey && CONFIRM_PRESETS[matchedKey] ? CONFIRM_PRESETS[matchedKey] : {};
        return {
            ...base,
            ...arg,
        };
    }

    return {
        title: arg.title ?? "Confirmation",
        description: arg.description ?? "Are you sure you want to continue?",
        button1: arg.button1 ?? "Cancel",
        button2: arg.button2 ?? "Confirm",
        variant: arg.variant,
        icon: arg.icon,
    };
}

interface PopupComponentProps extends ConfirmPopupOptions {
    onClose: (confirmed: boolean) => void;
}

const ConfirmationModal: React.FC<PopupComponentProps> = ({
    title = "Confirmation",
    description = "Are you sure you want to continue?",
    button1 = "Cancel",
    button2 = "Confirm",
    variant,
    icon,
    onClose,
    showButton1 = true
}) => {
    // Resolve variant automatically if not explicitly provided
    const resolvedVariant: ConfirmPopupVariant = variant || (() => {
        const text = `${title} ${button2}`.toLowerCase();
        if (
            text.includes("delete") ||
            text.includes("remove") ||
            text.includes("destroy") ||
            text.includes("terminate")
        ) {
            return "danger";
        }
        if (
            text.includes("warning") ||
            text.includes("caution") ||
            text.includes("lock") ||
            text.includes("expire")
        ) {
            return "warning";
        }
        return "primary";
    })();

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // Icon representation
    const renderIcon = () => {
        if (icon) return icon;
        switch (resolvedVariant) {
            case "danger":
                return <AlertCircle className="w-5 h-5 text-error" />;
            case "warning":
                return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case "info":
                return <Info className="w-5 h-5 text-primary" />;
            case "primary":
            default:
                return <HelpCircle className="w-5 h-5 text-primary" />;
        }
    };

    const getIconWrapperClasses = () => {
        switch (resolvedVariant) {
            case "danger":
                return "bg-error/10 border-error/20 text-error";
            case "warning":
                return "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400";
            case "info":
            case "primary":
            default:
                return "bg-primary/10 border-primary/20 text-primary";
        }
    };

    const getConfirmButtonClasses = () => {
        switch (resolvedVariant) {
            case "danger":
                return "bg-error hover:bg-error-container text-on-error hover:text-on-error-container";
            case "warning":
                return "bg-amber-600 hover:bg-amber-700 text-white";
            case "info":
            case "primary":
            default:
                return "bg-primary hover:bg-primary-container text-on-primary";
        }
    };

    return (
        <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose(false);
                }
            }}
        >
            <div
                className="relative w-full max-w-md bg-surface-container dark:bg-dark-surface-container border border-outline-variant dark:border-dark-outline-variant rounded shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col text-on-surface dark:text-dark-on-surface"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-description"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant dark:border-dark-outline-variant bg-surface-container-low dark:bg-dark-surface-container-low shrink-0">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div
                            className={`p-2 rounded border shrink-0 flex items-center justify-center ${getIconWrapperClasses()}`}
                        >
                            {renderIcon()}
                        </div>
                        <h3
                            id="confirm-title"
                            className="text-sm sm:text-base font-semibold text-on-surface dark:text-dark-on-surface truncate"
                        >
                            {title}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => onClose(false)}
                        className="p-1.5 rounded text-on-surface-variant dark:text-dark-on-surface-variant hover:text-on-surface dark:hover:text-dark-on-surface hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high transition-colors cursor-pointer shrink-0"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-5 py-5">
                    <p
                        id="confirm-description"
                        className="text-xs sm:text-sm text-on-surface-variant dark:text-dark-on-surface-variant leading-relaxed whitespace-pre-wrap"
                    >
                        {description}
                    </p>
                </div>

                {/* Footer / Actions */}
                <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 border-t border-outline-variant dark:border-dark-outline-variant bg-surface-container-low dark:bg-dark-surface-container-low shrink-0">

                    {showButton1 && (
                        <button
                            type="button"
                            onClick={() => onClose(false)}
                            className="px-4 py-2 text-xs font-semibold rounded border border-outline-variant dark:border-dark-outline-variant bg-surface-container dark:bg-dark-surface-container hover:bg-surface-container-high dark:hover:bg-dark-surface-container-high text-on-surface dark:text-dark-on-surface transition-colors cursor-pointer active:scale-95"
                        >
                            {button1}
                        </button>)}

                    <button
                        type="button"
                        onClick={() => onClose(true)}
                        className={`px-4 py-2 text-xs font-semibold rounded transition-all cursor-pointer active:scale-95 shadow-xs flex items-center gap-1.5 ${getConfirmButtonClasses()}`}
                        autoFocus
                    >
                        {button2}
                    </button>
                </div>
            </div>
        </div>
    );
};

export function confirmPopup(arg?: ConfirmPopupArg): Promise<boolean> {
    const options = resolveOptions(arg);

    return new Promise((resolve) => {
        const container = document.createElement("div");
        document.body.appendChild(container);

        const root = createRoot(container);
        let finished = false;

        const close = (confirmed: boolean) => {
            if (finished) return;
            finished = true;
            root.unmount();
            container.remove();
            resolve(confirmed);
        };

        root.render(
            <ConfirmationModal
                {...options}
                onClose={close}
            />
        );
    });
}

