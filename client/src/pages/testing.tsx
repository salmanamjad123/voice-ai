import React from "react";
import { AudioRecorder } from "react-audio-voice-recorder";

const testing = () => {
  const addAudioElement = async (blob: Blob) => {
    console.log("recording...");

    // Convert the blob to a File object
    const audioFile = new File([blob], "recording.webm", {
      type: "audio/webm",
    });

    console.log("audioFile", audioFile);

    // Send the audio file to OpenAI API for transcription
    await sendAudioToOpenAI(audioFile);
  };

  const sendAudioToOpenAI = async (audioFile: File) => {
    console.log("inside sendAudioToOpenAI");

    

    const formData = new FormData();
    formData.append("file", audioFile); // Append the audio file
    formData.append("model", "whisper-1"); // Specify the model

    try {
      const response = await fetch(openaiUrl, {
        method: "POST",
        headers: {
          // Do not set Content-Type header when using FormData
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData, // Send the FormData object
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const responseBody = await response.json();
      const transcribedText = responseBody.text; // Get the transcribed text
      console.log("Transcribed Text:", transcribedText);
    } catch (error) {
      console.error("Error sending audio to OpenAI:", error);
    }
  };

  return (
    <div>
      <span className="text-red-500">test</span>

      <button className="bg-red-500">
        <AudioRecorder
          onRecordingComplete={addAudioElement}
          audioTrackConstraints={{
            noiseSuppression: true,
            echoCancellation: true,
          }}
          //   downloadOnSavePress={true}
          downloadFileExtension="webm"
        />
      </button>
    </div>
  );
};

export default testing;
