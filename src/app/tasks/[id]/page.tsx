import { Suspense } from "react";
import { TaskDetailsView } from "@/views/taskDetails";

type TaskPageProps = {
  params: Promise<{ id: string }>;
};

const TaskPage = async ({ params }: TaskPageProps) => {
  const { id } = await params;

  return (
    <Suspense>
      <TaskDetailsView key={id} id={id} />
    </Suspense>
  );
};

export default TaskPage;
