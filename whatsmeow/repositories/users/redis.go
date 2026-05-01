package users

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/verbeux-ai/whatsmiau/env"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"golang.org/x/net/context"
)

var _ interfaces.UserRepository = (*RedisUser)(nil)

type RedisUser struct {
	sqlRepo interfaces.UserRepository
	redis   *redis.Client
	ttl     time.Duration
}

func NewRedis(sqlRepo interfaces.UserRepository, redisClient *redis.Client) *RedisUser {
	return &RedisUser{
		sqlRepo: sqlRepo,
		redis:   redisClient,
		ttl:     5 * time.Minute,
	}
}

func (r *RedisUser) key(id string) string {
	return fmt.Sprintf("user_%s", id)
}

func (r *RedisUser) emailKey(email string) string {
	return fmt.Sprintf("user_email_%s", email)
}

func (r *RedisUser) listKey(companyID *string) string {
	if companyID != nil && *companyID != "" {
		return fmt.Sprintf("users_list_company_%s", *companyID)
	}
	return "users_list_all"
}

func (r *RedisUser) Create(ctx context.Context, user *models.User) error {
	if err := r.sqlRepo.Create(ctx, user); err != nil {
		return err
	}

	// Invalidate list cache
	r.redis.Del(ctx, r.listKey(user.CompanyID))
	r.redis.Del(ctx, r.listKey(nil))

	// Cache the new user
	data, _ := json.Marshal(user)
	r.redis.Set(ctx, r.key(user.ID), data, r.ttl)
	r.redis.Set(ctx, r.emailKey(user.Email), data, r.ttl)

	return nil
}

func (r *RedisUser) List(ctx context.Context, companyID *string) ([]models.User, error) {
	// Try list cache
	cached, err := r.redis.Get(ctx, r.listKey(companyID)).Result()
	if err == nil {
		var users []models.User
		if json.Unmarshal([]byte(cached), &users) == nil {
			return users, nil
		}
	}

	// Fallback to SQL
	users, err := r.sqlRepo.List(ctx, companyID)
	if err != nil {
		return nil, err
	}

	// Cache the list
	data, _ := json.Marshal(users)
	r.redis.Set(ctx, r.listKey(companyID), data, r.ttl)

	return users, nil
}

func (r *RedisUser) GetByID(ctx context.Context, id string) (*models.User, error) {
	// Try cache first
	cached, err := r.redis.Get(ctx, r.key(id)).Result()
	if err == nil {
		var user models.User
		if json.Unmarshal([]byte(cached), &user) == nil {
			return &user, nil
		}
	}

	// Fallback to SQL
	user, err := r.sqlRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Cache the user
	data, _ := json.Marshal(user)
	r.redis.Set(ctx, r.key(id), data, r.ttl)
	r.redis.Set(ctx, r.emailKey(user.Email), data, r.ttl)

	return user, nil
}

func (r *RedisUser) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	// Try cache first
	cached, err := r.redis.Get(ctx, r.emailKey(email)).Result()
	if err == nil {
		var user models.User
		if json.Unmarshal([]byte(cached), &user) == nil {
			// Log cache hit (apenas em desenvolvimento)
			if env.Env.DebugMode {
				fmt.Printf("[CACHE HIT] User by email: %s (ID: %s)\n", email, user.ID)
			}
			return &user, nil
		}
	}

	// Fallback to SQL
	user, err := r.sqlRepo.GetByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	// Cache the user
	data, _ := json.Marshal(user)
	r.redis.Set(ctx, r.key(user.ID), data, r.ttl)
	r.redis.Set(ctx, r.emailKey(email), data, r.ttl)

	// Log cache miss (apenas em desenvolvimento)
	if env.Env.DebugMode {
		fmt.Printf("[CACHE MISS] User by email: %s (ID: %s) - Cached\n", email, user.ID)
	}

	return user, nil
}

func (r *RedisUser) Update(ctx context.Context, id string, user *models.User) (*models.User, error) {
	// Get old user to invalidate email cache
	oldUser, _ := r.sqlRepo.GetByID(ctx, id)

	updated, err := r.sqlRepo.Update(ctx, id, user)
	if err != nil {
		return nil, err
	}

	// Invalidate caches
	r.redis.Del(ctx, r.key(id))
	if oldUser != nil {
		r.redis.Del(ctx, r.emailKey(oldUser.Email))
	}
	r.redis.Del(ctx, r.emailKey(user.Email))
	r.redis.Del(ctx, r.listKey(user.CompanyID))
	r.redis.Del(ctx, r.listKey(nil))

	// Cache updated user
	data, _ := json.Marshal(updated)
	r.redis.Set(ctx, r.key(id), data, r.ttl)
	r.redis.Set(ctx, r.emailKey(updated.Email), data, r.ttl)

	return updated, nil
}

func (r *RedisUser) Delete(ctx context.Context, id string) error {
	// Get user to invalidate caches
	user, _ := r.sqlRepo.GetByID(ctx, id)

	if err := r.sqlRepo.Delete(ctx, id); err != nil {
		return err
	}

	// Invalidate caches
	r.redis.Del(ctx, r.key(id))
	if user != nil {
		r.redis.Del(ctx, r.emailKey(user.Email))
		r.redis.Del(ctx, r.listKey(user.CompanyID))
	}
	r.redis.Del(ctx, r.listKey(nil))

	return nil
}
