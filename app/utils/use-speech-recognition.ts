import * as React from "react";

export interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  supported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

/** useSpeechRecognition wraps the browser Web Speech API.
 * `onFinalTranscript` is called once speech recognition produces a final result.
 */
export default function useSpeechRecognition(
  onFinalTranscript?: (transcript: string) => void,
): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = React.useState("");
  const [interimTranscript, setInterimTranscript] = React.useState("");
  const [isListening, setIsListening] = React.useState(false);

  // Keep a ref so the recognition event handler always calls the latest callback
  const onFinalTranscriptRef = React.useRef(onFinalTranscript);
  React.useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = React.useRef<any>(null);

  const supported =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in (window as any));

  const startListening = React.useCallback(() => {
    if (!supported) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionAPI = w.SpeechRecognition || w.webkitSpeechRecognition;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        const trimmed = final.trim();
        setTranscript(trimmed);
        setInterimTranscript("");
        onFinalTranscriptRef.current?.(trimmed);
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognition.onerror = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported]);

  const stopListening = React.useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const resetTranscript = React.useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  // Abort on unmount
  React.useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    transcript,
    interimTranscript,
    isListening,
    supported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
