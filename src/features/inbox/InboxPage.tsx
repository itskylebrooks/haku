import { useMemo, useState } from "react";
import ActivityCard from "../day/ActivityCard";
import {
  useActivitiesStore,
  getInboxActivities,
  getLaterActivities,
} from "../../shared/store/activitiesStore";
import type { Activity } from "../../shared/types/activity";
import AddActivityModal from "../../shared/components/AddActivityModal";

const InboxPage = () => {
  const activities = useActivitiesStore((state) => state.activities);
  const toggleDone = useActivitiesStore((state) => state.toggleDone);
  const deleteActivity = useActivitiesStore((state) => state.deleteActivity);
  const updateActivity = useActivitiesStore((state) => state.updateActivity);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activityBeingEdited, setActivityBeingEdited] = useState<Activity | null>(null);

  const inboxActivities = useMemo(
    () => getInboxActivities(activities),
    [activities]
  );
  const laterActivities = useMemo(
    () => getLaterActivities(activities),
    [activities]
  );

  const hasInbox = inboxActivities.length > 0;
  const hasLater = laterActivities.length > 0;
  const isEmpty = !hasInbox && !hasLater;

  const handleToggleDone = (id: string) => {
    toggleDone(id);
  };

  const handleEdit = (activity: Activity) => {
    setActivityBeingEdited(activity);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setActivityBeingEdited(null);
  };

  const handleDeleteActivity = (id: string) => {
    deleteActivity(id);
    handleCloseEditModal();
  };

  return (
    <>
      <div className="mx-auto w-full max-w-xl px-4 pt-4 md:pt-0">
        {isEmpty && (
          <div className="py-16 text-center">
            <p className="text-sm text-[var(--color-text-subtle)]">
              No activities on your board yet.
            </p>
          </div>
        )}

        {hasInbox && (
          <div className="mb-6">
            <span className="mb-2 block text-center text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Inbox
            </span>
            <div className="space-y-1.5">
              {inboxActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onToggleDone={handleToggleDone}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </div>
        )}

        {hasLater && (
          <div className="mb-4">
            <span className="mb-2 block text-center text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Later
            </span>
            <div className="space-y-1.5">
              {laterActivities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onToggleDone={handleToggleDone}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <AddActivityModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        mode="edit"
        activityToEdit={activityBeingEdited ?? undefined}
        onDelete={handleDeleteActivity}
        onUpdate={updateActivity}
      />
    </>
  );
};

export default InboxPage;
