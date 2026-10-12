# Form submission and success toasts

This guide explains how a form submission reaches its success toast in the
frontend. The patient form is used as the example; other forms follow the same
pattern.

## Submission flow

1. The form uses React Hook Form's `handleSubmit` to validate values with its
   Zod resolver. If validation fails, the submit handler does not run and the
   field errors are rendered beside their inputs.
2. The form's `onSubmit` handler converts validated form values into the API
   payload and calls a feature service.
3. The service sends the request through the same-origin BFF client. The BFF
   attaches the server-held session and forwards the request to Flask.
4. The service promise resolves on success. The form then calls
   `toast.success(...)` and usually navigates to the new or updated record.
5. If the request fails, the promise rejects. The form catches the error and
   displays an error message; it does not show the success toast.

## Patient form example

In [`PatientForm`](../features/patients/components/patient-form.tsx), the form
connects submit events to the handler:

```tsx
<form onSubmit={handleSubmit(onSubmit)} noValidate>
```

The handler clears prior errors, prepares the payload, and waits for the API
before reporting success:

```ts
async function onSubmit(values: PatientFormValues) {
  setFormError(null);
  setDuplicateId(null);
  const payload = toPatientPayload(patientFormSchema.parse(values));

  try {
    if (patient) {
      await patientService.update(patient.id, payload);
      toast.success("Patient updated");
      router.push(`/patients/${patient.id}`);
    } else {
      const created = await patientService.create(payload);
      toast.success(`Patient registered as ${created.mrn}`);
      router.push(`/patients/${created.id}`);
    }
    router.refresh();
  } catch (error) {
    setFormError(
      isApiError(error) ? error.displayMessage : "The request could not be completed.",
    );
  }
}
```

The actual patient form also handles a `409` duplicate-record conflict separately
so it can link to the existing patient.

`patientService.create` and `patientService.update` are defined in
[`patient-service.ts`](../services/patients/patient-service.ts). They return
promises, so `await` ensures the success toast is shown only after the
operation succeeds.

## Where the toast appears

The shared [`Toaster`](../components/ui/sonner.tsx) is mounted once by
[`Providers`](../components/providers.tsx), which wraps the application in
[`layout.tsx`](../app/layout.tsx). Forms can therefore call `toast.success`
without rendering their own toast container.

## Adding a success toast to another form

- Put the request in the form's submit handler and `await` it.
- Call `toast.success` only after the awaited request resolves.
- Keep the success message specific to the completed action.
- Handle rejected requests in `catch` and show an error instead.
- Navigate or refresh after success if the workflow requires it.
