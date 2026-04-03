import { useFetcher } from "@remix-run/react";
import classNames from "classnames";
import * as React from "react";

import Button from "~/components/button";
import type { RoomProps } from "~/components/game";
import type { Action, Player } from "~/engine";
import { useEngineContext } from "~/engine";
import type { AiCheckResult } from "~/routes/room.$roomId.ai-check";
import { formatDollarsWithSign } from "~/utils";
import useSoloAction from "~/utils/use-solo-action";
import useTimeout from "~/utils/use-timeout";

const REVEAL_ANSWER_DEBOUNCE_MS = 500;
const AUTO_SUBMIT_DELAY_MS = 5000;
const AUTO_SUBMIT_DELAY_SEC = AUTO_SUBMIT_DELAY_MS / 1000;

function CheckForm({
  answer,
  longForm,
  loading,
  myAnswer,
  aiVerdict,
  isAiLoading,
  autoSubmitCountdown,
  voiceTranscript,
}: {
  answer: string;
  longForm: boolean;
  loading: boolean;
  myAnswer?: string;
  aiVerdict?: AiCheckResult;
  isAiLoading?: boolean;
  autoSubmitCountdown?: number;
  voiceTranscript?: string;
}) {
  const displayAnswer = voiceTranscript ?? myAnswer;

  if (isAiLoading) {
    return (
      <div className="flex flex-col items-center gap-2 p-2">
        {displayAnswer && (
          <p className="text-center text-sm text-slate-300">
            Your answer:{" "}
            <span className="font-handwriting text-2xl font-bold text-white">
              {displayAnswer}
            </span>
          </p>
        )}
        <p className="animate-pulse font-bold text-white">AI evaluating…</p>
      </div>
    );
  }

  if (aiVerdict !== undefined) {
    return (
      <div className="flex flex-col items-center gap-2 p-2">
        {longForm ? null : (
          <>
            <p className="text-center font-korinna text-2xl font-bold uppercase text-slate-300 shadow-sm">
              {answer}
            </p>
            <p className="text-center text-sm text-slate-300">
              (don&apos;t spoil the answer for others!)
            </p>
          </>
        )}
        {displayAnswer && (
          <p className="text-center text-sm text-slate-300">
            Your answer:{" "}
            <span className="font-handwriting text-2xl font-bold text-white">
              {displayAnswer}
            </span>
          </p>
        )}
        <p
          className={classNames("text-xl font-bold", {
            "text-green-300": aiVerdict.correct,
            "text-red-300": !aiVerdict.correct,
          })}
        >
          {aiVerdict.correct ? "Correct!" : "Incorrect"}
        </p>
        <p className="text-center text-sm text-slate-400">{aiVerdict.reasoning}</p>
        {autoSubmitCountdown !== undefined && autoSubmitCountdown > 0 && (
          <p className="text-center text-xs text-slate-400">
            Auto-submitting in {autoSubmitCountdown}s…
          </p>
        )}
        <p className="text-xs font-bold text-slate-300">Host override:</p>
        <div className="flex gap-2">
          <Button
            htmlType="submit"
            name="result"
            value="incorrect"
            loading={loading}
          >
            incorrect
          </Button>
          <Button
            htmlType="submit"
            name="result"
            value="correct"
            type="primary"
            loading={loading}
          >
            correct!
          </Button>
        </div>
      </div>
    );
  }

  // Manual fallback (no voice support or AI error)
  return (
    <div className="flex flex-col items-center gap-2 p-2">
      {longForm ? null : (
        <>
          <p className="text-center font-korinna text-2xl font-bold uppercase text-slate-300 shadow-sm">
            {answer}
          </p>
          <p className="text-center text-sm text-slate-300">
            (don&apos;t spoil the answer for others!)
          </p>
        </>
      )}
      {myAnswer && (
        <p className="text-center text-sm text-slate-300">
          Your answer:{" "}
          <span className="font-handwriting text-2xl font-bold text-white">
            {myAnswer}
          </span>
        </p>
      )}
      <p className="font-bold text-white">Were you right?</p>
      <div className="flex gap-2">
        <Button
          htmlType="submit"
          name="result"
          value="incorrect"
          loading={loading}
        >
          incorrect
        </Button>
        <Button
          htmlType="submit"
          name="result"
          value="correct"
          type="primary"
          autoFocus
          loading={loading}
        >
          correct!
        </Button>
      </div>
    </div>
  );
}

/** ConnectedCheckForm is shown to the winning buzzer at the bottom of the
 * prompt. They reveal the answer, then check whether it's correct or
 * incorrect.
 */
export function ConnectedCheckForm({
  roomId,
  userId,
  longForm = false,
  showAnswer,
  onClickShowAnswer,
  aiVerdict,
  isAiLoading,
  voiceTranscript,
}: {
  longForm?: boolean;
  showAnswer: boolean;
  onClickShowAnswer: () => void;
  aiVerdict?: AiCheckResult;
  isAiLoading?: boolean;
  voiceTranscript?: string;
} & RoomProps) {
  const {
    activeClue,
    clue,
    answeredBy,
    answers,
    getClueValue,
    soloDispatch,
    players,
  } = useEngineContext();
  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);
  const loading = fetcher.state === "loading";

  // Countdown display state (counts down from AUTO_SUBMIT_DELAY_SEC to 0)
  const [autoSubmitCountdown, setAutoSubmitCountdown] = React.useState<
    number | undefined
  >(undefined);

  // Track whether we've already submitted to avoid double-submission
  const hasSubmittedRef = React.useRef(false);

  // When AI verdict arrives, start the countdown display
  React.useEffect(() => {
    if (!aiVerdict) return;
    hasSubmittedRef.current = false;
    setAutoSubmitCountdown(AUTO_SUBMIT_DELAY_SEC);
    const interval = setInterval(() => {
      setAutoSubmitCountdown((prev) =>
        prev !== undefined && prev > 0 ? prev - 1 : prev,
      );
    }, 1000);
    return () => clearInterval(interval);
  }, [aiVerdict]);

  // Cancel countdown if a manual override was submitted
  React.useEffect(() => {
    if (fetcher.state !== "idle") {
      hasSubmittedRef.current = true;
    }
  }, [fetcher.state]);

  // Auto-submit after the delay using the AI verdict
  useTimeout(
    () => {
      if (hasSubmittedRef.current || !aiVerdict || !activeClue) return;
      hasSubmittedRef.current = true;
      const [i, j] = activeClue;
      fetcher.submit(
        {
          userId,
          i: i.toString(),
          j: j.toString(),
          result: aiVerdict.correct ? "correct" : "incorrect",
        },
        { method: "post", action: `/room/${roomId}/check` },
      );
    },
    aiVerdict !== undefined ? AUTO_SUBMIT_DELAY_MS : null,
  );

  // Disable the "show answer" button briefly on render to prevent double-clicks.
  const [disabled, setDisabled] = React.useState(true);
  useTimeout(
    () => setDisabled(false),
    showAnswer ? null : REVEAL_ANSWER_DEBOUNCE_MS,
  );

  if (!activeClue || !clue) {
    throw new Error("No active clue");
  }

  // Show the "Reveal answer" button only when there's no voice/AI flow active
  if (!showAnswer && !aiVerdict && !isAiLoading) {
    return (
      <div className="flex flex-col items-center gap-2 p-2">
        <p className="text-sm text-slate-300">
          Answer in the form of a question, then
        </p>
        <div className="relative">
          <span
            className={classNames(
              "absolute left-1/6 top-1/6 inline-flex h-2/3 w-2/3 rounded-md bg-blue-300 opacity-75",
              {
                "animate-ping": !disabled,
              },
            )}
          />
          <Button
            type="primary"
            htmlType="button"
            autoFocus={!disabled}
            disabled={disabled}
            onClick={onClickShowAnswer}
            loading={loading}
            className="relative"
          >
            Reveal answer
          </Button>
        </div>
      </div>
    );
  }

  const [i, j] = activeClue;
  const myAnswer = answers.get(userId);
  const checkResult = answeredBy(i, j, userId);

  if (checkResult !== undefined) {
    const clueValue = getClueValue(activeClue, userId);
    const value = checkResult ? clueValue : -1 * clueValue;

    const uncheckedPlayers = Array.from(answers.keys())
      .map((uid) => players.get(uid))
      .filter((p): p is Player => p !== undefined)
      .filter((p) => answeredBy(i, j, p.userId) === undefined);

    return (
      <div className="flex flex-col items-center gap-2 p-2">
        <p className="font-bold text-white">
          You {checkResult ? "won" : "lost"}{" "}
          <span
            className={classNames("text-shadow", {
              "text-green-300": checkResult,
              "text-red-300": !checkResult,
            })}
          >
            {formatDollarsWithSign(value)}
          </span>
        </p>
        <p className="text-sm text-slate-300">
          Waiting for check(s) from{" "}
          {uncheckedPlayers.map((p) => p.name).join(", ")}...
        </p>
      </div>
    );
  }

  return (
    <fetcher.Form method="POST" action={`/room/${roomId}/check`}>
      <input type="hidden" value={userId} name="userId" />
      <input type="hidden" value={i} name="i" />
      <input type="hidden" value={j} name="j" />
      <CheckForm
        longForm={longForm}
        loading={loading}
        myAnswer={myAnswer}
        answer={clue.answer}
        aiVerdict={aiVerdict}
        isAiLoading={isAiLoading}
        autoSubmitCountdown={autoSubmitCountdown}
        voiceTranscript={voiceTranscript}
      />
    </fetcher.Form>
  );
}
