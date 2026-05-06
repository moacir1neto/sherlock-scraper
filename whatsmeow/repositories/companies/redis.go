package companies

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/verbeux-ai/whatsmiau/interfaces"
	"github.com/verbeux-ai/whatsmiau/models"
	"golang.org/x/net/context"
)

var _ interfaces.CompanyRepository = (*RedisCompany)(nil)

type RedisCompany struct {
	sqlRepo interfaces.CompanyRepository
	redis   *redis.Client
	ttl     time.Duration
}

func NewRedis(sqlRepo interfaces.CompanyRepository, redisClient *redis.Client) *RedisCompany {
	return &RedisCompany{
		sqlRepo: sqlRepo,
		redis:   redisClient,
		ttl:     5 * time.Minute,
	}
}

func (r *RedisCompany) key(id string) string {
	return fmt.Sprintf("company_%s", id)
}

func (r *RedisCompany) listKey() string {
	return "companies_list"
}

func (r *RedisCompany) Create(ctx context.Context, company *models.Company) error {
	if err := r.sqlRepo.Create(ctx, company); err != nil {
		return err
	}

	// Invalidate list cache
	r.redis.Del(ctx, r.listKey())

	// Cache the new company
	data, _ := json.Marshal(company)
	r.redis.Set(ctx, r.key(company.ID), data, r.ttl)

	return nil
}

func (r *RedisCompany) List(ctx context.Context, id string) ([]models.Company, error) {
	if id != "" {
		// Try cache first
		cached, err := r.redis.Get(ctx, r.key(id)).Result()
		if err == nil {
			var company models.Company
			if json.Unmarshal([]byte(cached), &company) == nil {
				return []models.Company{company}, nil
			}
		}

		// Fallback to SQL
		return r.sqlRepo.List(ctx, id)
	}

	// Try list cache
	cached, err := r.redis.Get(ctx, r.listKey()).Result()
	if err == nil {
		var companies []models.Company
		if json.Unmarshal([]byte(cached), &companies) == nil {
			return companies, nil
		}
	}

	// Fallback to SQL
	companies, err := r.sqlRepo.List(ctx, id)
	if err != nil {
		return nil, err
	}

	// Cache the list
	data, _ := json.Marshal(companies)
	r.redis.Set(ctx, r.listKey(), data, r.ttl)

	return companies, nil
}

func (r *RedisCompany) GetByID(ctx context.Context, id string) (*models.Company, error) {
	// Try cache first
	cached, err := r.redis.Get(ctx, r.key(id)).Result()
	if err == nil {
		var company models.Company
		if json.Unmarshal([]byte(cached), &company) == nil {
			return &company, nil
		}
	}

	// Fallback to SQL
	company, err := r.sqlRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	// Cache the company
	data, _ := json.Marshal(company)
	r.redis.Set(ctx, r.key(id), data, r.ttl)

	return company, nil
}

func (r *RedisCompany) Update(ctx context.Context, id string, company *models.Company) (*models.Company, error) {
	updated, err := r.sqlRepo.Update(ctx, id, company)
	if err != nil {
		return nil, err
	}

	// Invalidate caches
	r.redis.Del(ctx, r.key(id))
	r.redis.Del(ctx, r.listKey())

	// Cache updated company
	data, _ := json.Marshal(updated)
	r.redis.Set(ctx, r.key(id), data, r.ttl)

	return updated, nil
}

func (r *RedisCompany) Delete(ctx context.Context, id string) error {
	if err := r.sqlRepo.Delete(ctx, id); err != nil {
		return err
	}

	// Invalidate caches
	r.redis.Del(ctx, r.key(id))
	r.redis.Del(ctx, r.listKey())

	return nil
}
