namespace Roster.Domain.Events;
public record InningFieldingAssigned : DomainEvent
{
    public override string EventType { get; init; } = nameof(InningFieldingAssigned);
    public required Guid GameId { get; init; }
    public required int InningNumber { get; init; }
    public required IReadOnlyList<FieldingAssignmentRecord> Assignments { get; init; }
}

public record FieldingAssignmentRecord(Guid PlayerId, string Position);
