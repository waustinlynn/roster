namespace Roster.Application.Commands.RenamePlayer;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class RenamePlayerCommandHandler : IRequestHandler<RenamePlayerCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public RenamePlayerCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(RenamePlayerCommand request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        if (!team.Players.TryGetValue(request.PlayerId, out var player))
            throw new DomainException($"Player {request.PlayerId} not found.");

        if (string.IsNullOrWhiteSpace(request.NewName) || request.NewName.Length > 100)
            throw new DomainException("Player name must be between 1 and 100 characters.");

        var @event = new PlayerRenamed
        {
            TeamId = request.TeamId,
            PlayerId = request.PlayerId,
            NewName = request.NewName.Trim(),
        };

        await _eventStore.AppendAsync([@event], cancellationToken);
    }
}
