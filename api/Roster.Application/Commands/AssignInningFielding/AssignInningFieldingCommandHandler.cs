namespace Roster.Application.Commands.AssignInningFielding;

using MediatR;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class AssignInningFieldingCommandHandler : IRequestHandler<AssignInningFieldingCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public AssignInningFieldingCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(AssignInningFieldingCommand request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        var game = _store.GetGame(request.GameId)
            ?? throw new DomainException($"Game {request.GameId} not found.");

        if (game.IsLocked)
            throw new DomainException("This game is locked and cannot be modified.");

        if (request.InningNumber < 1 || request.InningNumber > game.InningCount)
            throw new DomainException($"Inning number must be between 1 and {game.InningCount}.");

        var activePresentIds = team.Players.Values
            .Where(p => p.IsActive && !game.AbsentPlayerIds.Contains(p.PlayerId))
            .Select(p => p.PlayerId)
            .ToHashSet();

        var assignedIds = request.Assignments.Select(a => a.PlayerId).ToList();

        foreach (var pid in activePresentIds)
        {
            var count = assignedIds.Count(id => id == pid);
            if (count != 1)
                throw new DomainException($"Player {pid} must appear exactly once in inning assignments (found {count}).");
        }

        foreach (var pid in assignedIds)
        {
            if (!activePresentIds.Contains(pid))
                throw new DomainException($"Player {pid} is absent, inactive, or not on this team.");
        }

        var validPositions = team.Sport!.Positions.ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var a in request.Assignments)
        {
            if (!string.Equals(a.Position, "Bench", StringComparison.OrdinalIgnoreCase) &&
                !validPositions.Contains(a.Position))
                throw new DomainException($"'{a.Position}' is not a valid position for {team.Sport.Name}.");
        }

        await _eventStore.AppendAsync([new InningFieldingAssigned
        {
            TeamId = request.TeamId,
            GameId = request.GameId,
            InningNumber = request.InningNumber,
            Assignments = request.Assignments
                .Select(a => new FieldingAssignmentRecord(a.PlayerId, a.Position))
                .ToList(),
        }], cancellationToken);
    }
}
