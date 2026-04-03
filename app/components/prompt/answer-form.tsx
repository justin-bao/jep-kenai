import { useFetcher } from "@remix-run/react";
import * as React from "react";

import Button from "~/components/button";
import type { RoomProps } from "~/components/game";
import Input from "~/components/input";
import type { Action } from "~/engine";
import { useEngineContext } from "~/engine";
import useSoloAction from "~/utils/use-solo-action";
import useSpeechRecognition from "~/utils/use-speech-recognition";

function AnswerForm({
  submittedAnswer,
  loading,
}: {
  submittedAnswer?: string;
  loading: boolean;
}) {
  const [inputValue, setInputValue] = React.useState("");

  const handleFinalTranscript = React.useCallback((t: string) => {
    setInputValue(t);
  }, []);

  const { interimTranscript, isListening, startListening, stopListening, supported } =
    useSpeechRecognition(handleFinalTranscript);

  const displayValue = isListening ? interimTranscript : inputValue;

  return (
    <div className="flex flex-col items-center gap-2 p-2">
      {submittedAnswer ? (
        <>
          <p className="font-bold text-white">
            You answered:{" "}
            <span className="font-handwriting text-xl font-bold">
              {submittedAnswer}
            </span>
          </p>
          <p className="text-sm text-slate-300">
            You can change your answer until the last player submits an answer.
          </p>
        </>
      ) : null}
      <div className="flex gap-2">
        <Input
          type="text"
          id="answer"
          name="answer"
          placeholder="What is..."
          required
          value={displayValue}
          onChange={(e) => setInputValue(e.target.value)}
          className={`min-w-48 font-handwriting text-xl font-bold
          placeholder:font-sans placeholder:font-normal`}
        />
        {supported && (
          <Button
            type={isListening ? "primary" : undefined}
            htmlType="button"
            onClick={isListening ? stopListening : startListening}
            title={isListening ? "Stop recording" : "Record answer"}
          >
            {isListening ? "■" : "🎤"}
          </Button>
        )}
        <Button type="primary" htmlType="submit" loading={loading}>
          submit
        </Button>
      </div>
      {isListening && (
        <p className="animate-pulse text-xs text-slate-300">Listening...</p>
      )}
    </div>
  );
}

export function ConnectedAnswerForm({ roomId, userId }: RoomProps) {
  const { activeClue, answers, soloDispatch } = useEngineContext();
  if (!activeClue) {
    throw new Error("No active clue");
  }

  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);
  const loading = fetcher.state === "loading";

  const [i, j] = activeClue;
  const submittedAnswer = answers.get(userId);

  return (
    <fetcher.Form method="POST" action={`/room/${roomId}/answer`}>
      <input type="hidden" value={userId} name="userId" />
      <input type="hidden" value={i} name="i" />
      <input type="hidden" value={j} name="j" />
      <AnswerForm submittedAnswer={submittedAnswer} loading={loading} />
    </fetcher.Form>
  );
}
