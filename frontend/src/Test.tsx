import React, { useState } from "react";

const Test: React.FC = () => {
    const [status, setStatus] = useState("Microphone permission not requested");

    const requestMicrophone = async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                setStatus("Microphone access is not supported by this browser.");
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            setStatus("Microphone permission granted.");

            // Stop the microphone if you only needed permission.
            stream.getTracks().forEach((track) => track.stop());
        } catch (error) {
            console.error(error);

            if (error instanceof DOMException) {
                if (error.name === "NotAllowedError") {
                    setStatus(
                        "Microphone permission was denied. Please enable it in your browser settings."
                    );
                } else if (error.name === "NotFoundError") {
                    setStatus("No microphone was found.");
                } else {
                    setStatus(`Microphone error: ${error.name}`);
                }
            }
        }
    };

    return (
        <div>
            <button onClick={requestMicrophone}>
                Allow Microphone
            </button>

            <p>{status}</p>
        </div>
    );
};

export default Test;
