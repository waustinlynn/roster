namespace Roster.Domain.Interfaces;
using Roster.Domain.Events;

public interface IEventStore
{
    Task AppendAsync(IReadOnlyList<DomainEvent> events, CancellationToken ct = default);
}
