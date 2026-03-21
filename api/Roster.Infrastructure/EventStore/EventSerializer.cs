namespace Roster.Infrastructure.EventStore;

using System.Text.Json;
using System.Text.Json.Nodes;
using Roster.Domain.Events;

public static class EventSerializer
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static string Serialize(DomainEvent @event)
    {
        return @event switch
        {
            TeamCreated e => JsonSerializer.Serialize(e, Options),
            PlayerAdded e => JsonSerializer.Serialize(e, Options),
            PlayerSkillRated e => JsonSerializer.Serialize(e, Options),
            PlayerDeactivated e => JsonSerializer.Serialize(e, Options),
            GameCreated e => JsonSerializer.Serialize(e, Options),
            PlayerMarkedAbsent e => JsonSerializer.Serialize(e, Options),
            PlayerAbsenceRevoked e => JsonSerializer.Serialize(e, Options),
            BattingOrderSet e => JsonSerializer.Serialize(e, Options),
            InningFieldingAssigned e => JsonSerializer.Serialize(e, Options),
            GameLocked e => JsonSerializer.Serialize(e, Options),
            _ => throw new InvalidOperationException($"Unknown event type: {@event.GetType().Name}")
        };
    }

    public static DomainEvent? Deserialize(string json)
    {
        try
        {
            var node = JsonNode.Parse(json);
            var eventType = node?["eventType"]?.GetValue<string>();

            return eventType switch
            {
                nameof(TeamCreated) => JsonSerializer.Deserialize<TeamCreated>(json, Options),
                nameof(PlayerAdded) => JsonSerializer.Deserialize<PlayerAdded>(json, Options),
                nameof(PlayerSkillRated) => JsonSerializer.Deserialize<PlayerSkillRated>(json, Options),
                nameof(PlayerDeactivated) => JsonSerializer.Deserialize<PlayerDeactivated>(json, Options),
                nameof(GameCreated) => JsonSerializer.Deserialize<GameCreated>(json, Options),
                nameof(PlayerMarkedAbsent) => JsonSerializer.Deserialize<PlayerMarkedAbsent>(json, Options),
                nameof(PlayerAbsenceRevoked) => JsonSerializer.Deserialize<PlayerAbsenceRevoked>(json, Options),
                nameof(BattingOrderSet) => JsonSerializer.Deserialize<BattingOrderSet>(json, Options),
                nameof(InningFieldingAssigned) => JsonSerializer.Deserialize<InningFieldingAssigned>(json, Options),
                nameof(GameLocked) => JsonSerializer.Deserialize<GameLocked>(json, Options),
                _ => null
            };
        }
        catch
        {
            return null;
        }
    }
}
