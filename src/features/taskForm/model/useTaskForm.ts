import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { TaskFieldErrors, TaskFormField, TaskFormValues } from "./types";
import { getTaskFieldErrors, TASK_FIELDS, validateTaskForm } from "./validation";

export const useTaskForm = (initialValues: TaskFormValues, onSave: (values: TaskFormValues) => Promise<void>) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<TaskFieldErrors>({});
  const [focusRequest, setFocusRequest] = useState<{ field: TaskFormField }>();
  const [pending, setPending] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);

  useEffect(() => {
    if (pending || !focusRequest) return;
    const { field } = focusRequest;
    const checked = form.current?.querySelector<HTMLElement>(`[name="${field}"]:checked`);
    const first = form.current?.querySelector<HTMLElement>(`[name="${field}"]`);
    (checked ?? first)?.focus();
  }, [focusRequest, pending]);

  const change = <Field extends TaskFormField>(field: Field, value: TaskFormValues[Field]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => prev[field] ? { ...prev, [field]: undefined } : prev);
  };

  const showErrors = (fieldErrors: TaskFieldErrors) => {
    setErrors(fieldErrors);
    const field = TASK_FIELDS.find((name) => fieldErrors[name]);
    if (field) setFocusRequest({ field });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current) return;
    const result = validateTaskForm(values);
    if (!result.values) {
      showErrors(result.errors);
      return;
    }

    submitting.current = true;
    setPending(true);
    setErrors({});
    setFocusRequest(undefined);
    try {
      await onSave(result.values);
    } catch (error) {
      const fieldErrors = getTaskFieldErrors(error);
      if (fieldErrors) showErrors(fieldErrors);
      else toast.error("Не вдалося зберегти. Спробуйте ще раз");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  };

  return { form, values, errors, pending, change, submit };
};
