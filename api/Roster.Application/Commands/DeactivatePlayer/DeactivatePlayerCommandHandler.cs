namespace Roster.Application.Commands.DeactivatePlayer;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class DeactivatePlayerCommandHandler : IRequestHandler<DeactivatePlayerCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public DeactivatePlayerCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(DeactivatePlayerCommand request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        if (!team.Players.TryGetValue(request.PlayerId, out var player))
            throw new DomainException($"Player {request.PlayerId} not found.");

        if (!player.IsActive)
            throw new DomainException($"Player '{player.Name}' is already inactive.");

        var @event = new PlayerDeactivated { TeamId = request.TeamId, PlayerId = request.PlayerId };
        await _eventStore.AppendAsync([@event], cancellationToken);
    }
}
