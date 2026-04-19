namespace Roster.Application.Commands.UpdateGameLineup;

using MediatR;
using Roster.Application.Commands.AssignInningFielding;
using Roster.Application.Interfaces;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;
using Roster.Domain.Interfaces;

public class UpdateGameLineupCommandHandler : IRequestHandler<UpdateGameLineupCommand>
{
    private readonly IEventStore _eventStore;
    private readonly IInMemoryStore _store;

    public UpdateGameLineupCommandHandler(IEventStore eventStore, IInMemoryStore store)
    {
        _eventStore = eventStore;
        _store = store;
    }

    public async Task Handle(UpdateGameLineupCommand request, CancellationToken cancellationToken)
    {
        var team = _store.GetTeam(request.TeamId)
            ?? throw new DomainException($"Team {request.TeamId} not found.");

        var game = _store.GetGame(request.GameId)
            ?? throw new DomainException($"Game {request.GameId} not found.");

        if (game.IsLocked)
            throw new DomainException("This game is locked and cannot be modified.");

        // Validate batting order
        if (!request.BattingOrder.Any())
            throw new DomainException("Batting order must include at least one player.");

        if (request.BattingOrder.Distinct().Count() != request.BattingOrder.Count)
            throw new DomainException("Batting order contains duplicate player IDs.");

        foreach (var playerId in request.BattingOrder)
        {
            if (!team.Players.TryGetValue(playerId, out var player))
                throw new DomainException($"Player {playerId} not found on this team.");
            if (!player.IsActive)
                throw new DomainException($"Player '{player.Name}' is not active.");
            if (game.AbsentPlayerIds.Contains(playerId))
                throw new DomainException($"Player '{player.Name}' is marked absent for this game.");
        }

        // Validate inning assignments
        var activePresentIds = team.Players.Values
            .Where(p => p.IsActive && !game.AbsentPlayerIds.Contains(p.PlayerId))
            .Select(p => p.PlayerId)
            .ToHashSet();

        var validPositions = team.Sport!.Positions.ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var (inningNumber, assignments) in request.InningAssignments)
        {
            if (inningNumber < 1 || inningNumber > game.InningCount)
                throw new DomainException($"Inning number must be between 1 and {game.InningCount}.");

            var assignedIds = assignments.Select(a => a.PlayerId).ToList();

            foreach (var pid in activePresentIds)
            {
                var count = assignedIds.Count(id => id == pid);
                if (count != 1)
                    throw new DomainException($"Player {pid} must appear exactly once in inning {inningNumber} assignments (found {count}).");
            }

            foreach (var pid in assignedIds)
            {
                if (!activePresentIds.Contains(pid))
                    throw new DomainException($"Player {pid} is absent, inactive, or not on this team.");
            }

            foreach (var a in assignments)
            {
                if (!string.Equals(a.Position, "Bench", StringComparison.OrdinalIgnoreCase) &&
                    !validPositions.Contains(a.Position))
                    throw new DomainException($"'{a.Position}' is not a valid position for {team.Sport.Name}.");
            }
        }

        var events = new List<DomainEvent>
        {
            new BattingOrderSet
            {
                TeamId = request.TeamId,
                GameId = request.GameId,
                OrderedPlayerIds = request.BattingOrder,
            }
        };

        foreach (var (inningNumber, assignments) in request.InningAssignments.OrderBy(k => k.Key))
        {
            events.Add(new InningFieldingAssigned
            {
                TeamId = request.TeamId,
                GameId = request.GameId,
                InningNumber = inningNumber,
                Assignments = assignments
                    .Select(a => new FieldingAssignmentRecord(a.PlayerId, a.Position))
                    .ToList(),
            });
        }

        await _eventStore.AppendAsync(events, cancellationToken);
    }
}
