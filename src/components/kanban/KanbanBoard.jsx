import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

/**
 * Generic kanban board built on @hello-pangea/dnd v17.
 *
 * Props:
 * - columns: [{ id, title, icon?, accent?, items: [] }] — accent is a tailwind text/bg hint
 * - onMove(draggableId, fromColumnId, toColumnId) — called after a cross-column drop;
 *   the parent owns persistence + optimistic cache updates.
 * - renderCard(item) — visual content of a card (wrapped in Draggable here).
 * - getId(item) — stable draggable id.
 * - emptyText — shown in empty columns.
 */
export function KanbanBoard({ columns, onMove, renderCard, getId, emptyText = "—" }) {
  const handleDragEnd = (result) => {
    const { draggableId, source, destination } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    onMove(draggableId, source.droppableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-4 items-start"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(230px, 1fr))`, minWidth: columns.length * 250 }}
        >
          {columns.map(col => (
            <KanbanColumn key={col.id} col={col} renderCard={renderCard} getId={getId} emptyText={emptyText} />
          ))}
        </div>
      </div>
    </DragDropContext>
  );
}

function KanbanColumn({ col, renderCard, getId, emptyText }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/20 dark:bg-secondary/10 flex flex-col min-h-[220px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${col.dot || "bg-muted-foreground"}`} />
          <h3 className="font-semibold text-sm text-foreground">{col.title}</h3>
        </div>
        <span className="text-xs font-bold text-muted-foreground bg-background border border-border/60 rounded-full px-2 py-0.5 min-w-[1.6rem] text-center">
          {col.items.length}
        </span>
      </div>
      <Droppable droppableId={col.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2.5 space-y-2.5 transition-colors rounded-b-2xl ${
              snapshot.isDraggingOver ? "bg-primary/5" : ""
            }`}
          >
            {col.items.map((item, index) => (
              <Draggable key={getId(item)} draggableId={getId(item)} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    className={`bg-card rounded-xl border p-3 select-none transition-shadow ${
                      dragSnapshot.isDragging
                        ? "border-primary/50 shadow-xl shadow-primary/10 rotate-1"
                        : "border-border/60 shadow-sm hover:shadow-md"
                    }`}
                    style={dragProvided.draggableProps.style}
                  >
                    {renderCard(item)}
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {col.items.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-center text-xs text-muted-foreground py-8">{emptyText}</p>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
