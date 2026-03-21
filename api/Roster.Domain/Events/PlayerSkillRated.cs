namespace Roster.Domain.Events;
public record PlayerSkillRated : DomainEvent
{
    public override string EventType { get; init; } = nameof(PlayerSkillRated);
    public required Guid PlayerId { get; init; }
    public required string SkillName { get; init; }
    public required int Rating { get; init; }
}
