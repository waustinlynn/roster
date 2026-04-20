namespace Roster.Domain.Aggregates;
using Roster.Domain.Events;
using Roster.Domain.Exceptions;

public class GameAggregate
{
    public Guid GameId { get; private set; }
    public Guid TeamId { get; private set; }
    public DateOnly Date { get; private set; }
    public string? Opponent { get; private set; }
    public int InningCount { get; private set; }
    public bool IsLocked { get; private set; }
    public List<Guid> AbsentPlayerIds { get; private set; } = new();
    public List<Guid> BattingOrder { get; private set; } = new();
    public Dictionary<int, List<FieldingAssignment>> InningAssignments { get; private set; } = new();
    public Dictionary<int, InningScore> InningScores { get; private set; } = new();
    public string? Remarks { get; private set; }

    public void Apply(DomainEvent @event)
    {
        switch (@event)
        {
            case GameCreated e: Apply(e); break;
            case PlayerMarkedAbsent e: Apply(e); break;
            case PlayerAbsenceRevoked e: Apply(e); break;
            case BattingOrderSet e: Apply(e); break;
            case InningFieldingAssigned e: Apply(e); break;
            case GameLocked e: Apply(e); break;
            case InningScoreRecorded e: Apply(e); break;
            case GameScoresRecorded e: Apply(e); break;
            case GameRemarkRecorded e: Apply(e); break;
        }
    }

    private void Apply(GameCreated e)
    {
        GameId = e.GameId;
        TeamId = e.TeamId;
        Date = e.Date;
        Opponent = e.Opponent;
        InningCount = e.InningCount;
        IsLocked = false;
    }

    private void Apply(PlayerMarkedAbsent e)
    {
        GuardLocked();
        if (!AbsentPlayerIds.Contains(e.PlayerId))
            AbsentPlayerIds.Add(e.PlayerId);
    }

    private void Apply(PlayerAbsenceRevoked e)
    {
        GuardLocked();
        AbsentPlayerIds.Remove(e.PlayerId);
    }

    private void Apply(BattingOrderSet e)
    {
        GuardLocked();
        BattingOrder = e.OrderedPlayerIds.ToList();
    }

    private void Apply(InningFieldingAssigned e)
    {
        GuardLocked();
        var nonBench = e.Assignments
            .Where(a => !string.Equals(a.Position, "Bench", StringComparison.OrdinalIgnoreCase))
            .GroupBy(a => a.Position, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key)
            .ToList();

        if (nonBench.Any())
            throw new DomainException(
                $"Position conflict: '{nonBench[0]}' is assigned to multiple players in inning {e.InningNumber}.");

        InningAssignments[e.InningNumber] = e.Assignments
            .Select(a => new FieldingAssignment(a.PlayerId, a.Position))
            .ToList();
    }

    private void Apply(GameLocked e) => IsLocked = true;

    private void Apply(GameRemarkRecorded e) => Remarks = e.Remark;

    private void Apply(GameScoresRecorded e)
    {
        foreach (var (inning, score) in e.InningScores)
            InningScores[inning] = new InningScore(score.HomeScore, score.AwayScore);
    }

    private void Apply(InningScoreRecorded e)
    {
        if (e.InningNumber < 1 || e.InningNumber > InningCount)
            throw new DomainException($"Inning number must be between 1 and {InningCount}.");
        if (e.HomeScore < 0 || e.AwayScore < 0)
            throw new DomainException("Scores cannot be negative.");
        InningScores[e.InningNumber] = new InningScore(e.HomeScore, e.AwayScore);
    }

    private void GuardLocked()
    {
        if (IsLocked)
            throw new DomainException("This game is locked and cannot be modified.");
    }
}

public record FieldingAssignment(Guid PlayerId, string Position);
public record InningScore(int HomeScore, int AwayScore);
