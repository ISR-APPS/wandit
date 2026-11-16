// The search params of the Students page: the open student lives in the URL, as /app/students?student=stu-042.
// The /app/students route validates the URL with this schema. The home and the course page link to one student with it.
import { z } from "zod";

/** `student` is absent while the side panel is closed. A value that is not a text reads as absent. */
export const studentsSearchSchema = z.object({
	student: z.string().max(40).optional().catch(undefined),
});
